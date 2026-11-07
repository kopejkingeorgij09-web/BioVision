import AppKit
import Network
import WebKit

private let host = "127.0.0.1"
private let port: UInt16 = 17439
private let origin = URL(string: "http://\(host):\(port)")!

final class BundledServer {
    let root: URL
    private let listener: NWListener
    private let queue = DispatchQueue(label: "org.biovision.notes.server")
    private let types = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8",
        "mjs": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8",
        "svg": "image/svg+xml", "webmanifest": "application/manifest+json",
        "woff": "font/woff", "woff2": "font/woff2", "wasm": "application/wasm",
    ]

    init(root: URL) throws {
        self.root = root
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port)!)
        listener = try NWListener(using: parameters)
    }

    func start(_ state: @escaping (NWListener.State) -> Void) {
        listener.stateUpdateHandler = state
        listener.newConnectionHandler = { [weak self] connection in
            guard let self = self else { connection.cancel(); return }
            connection.start(queue: self.queue)
            self.receive(connection, Data())
        }
        listener.start(queue: queue)
    }

    private func receive(_ connection: NWConnection, _ existing: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, complete, error in
            guard let self = self, error == nil, let data = data else { connection.cancel(); return }
            let bytes = existing + data
            if bytes.count > 16_384 { self.respond(connection, "431 Request Header Fields Too Large"); return }
            if let end = bytes.range(of: Data("\r\n\r\n".utf8)) {
                let header = String(decoding: bytes[..<end.lowerBound], as: UTF8.self)
                self.handle(connection, header)
            } else if !complete {
                self.receive(connection, bytes)
            } else {
                connection.cancel()
            }
        }
    }

    private func handle(_ connection: NWConnection, _ header: String) {
        let lines = header.components(separatedBy: "\r\n")
        let request = lines.first?.split(separator: " ") ?? []
        guard request.count == 3, request[0] == "GET" || request[0] == "HEAD",
              lines.dropFirst().contains(where: { $0.lowercased() == "host: \(host):\(port)" }),
              let path = URLComponents(string: String(request[1]))?.path, path.hasPrefix("/") else {
            respond(connection, "400 Bad Request"); return
        }
        let relative = path == "/" ? "index.html" : String(path.dropFirst())
        let pieces = relative.split(separator: "/", omittingEmptySubsequences: false)
        guard pieces.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." && !$0.contains("\\") }),
              let data = try? Data(contentsOf: root.appendingPathComponent(relative), options: .mappedIfSafe) else {
            respond(connection, "404 Not Found"); return
        }
        let type = types[(relative as NSString).pathExtension] ?? "application/octet-stream"
        respond(connection, "200 OK", data, type: type, head: request[0] == "HEAD")
    }

    private func respond(_ connection: NWConnection, _ status: String, _ body: Data = Data(), type: String = "text/plain", head: Bool = false) {
        let header = "HTTP/1.1 \(status)\r\nConnection: close\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nX-Content-Type-Options: nosniff\r\n\r\n"
        connection.send(content: Data(header.utf8) + (head ? Data() : body), contentContext: .finalMessage,
                        isComplete: true, completion: .contentProcessed { _ in connection.cancel() })
    }
}

final class NotesApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    private var server: BundledServer?
    private var window: NSWindow?
    private var view: WKWebView?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(withTitle: "Завершить Поля", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let edit = NSMenu(title: "Правка")
        editItem.submenu = edit
        for (title, action, key) in [("Вырезать", "cut:", "x"), ("Копировать", "copy:", "c"),
                                     ("Вставить", "paste:", "v"), ("Выделить всё", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        NSApp.mainMenu = mainMenu

        let config = WKWebViewConfiguration()
        let script = WKUserScript(source: "window.NotesMac = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        config.userContentController.addUserScript(script)
        config.userContentController.add(self, name: "notesFullscreen")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        view = web
        let frame = CGRect(x: 0, y: 0, width: 1100, height: 800)
        let window = NSWindow(contentRect: frame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        self.window = window
        window.delegate = self
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.title = "Поля"
        window.contentView = web
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startServer()
    }

    private func startServer() {
        do {
            guard let root = Bundle.main.resourceURL?.appendingPathComponent("Web") else { throw CocoaError(.fileNoSuchFile) }
            let next = try BundledServer(root: root)
            server = next
            next.start { [weak self, weak next] state in
                DispatchQueue.main.async {
                    guard let self, let next, self.server === next else { return }
                    if case .ready = state { self.view?.load(URLRequest(url: origin)) }
                    if case .failed(let error) = state {
                        self.server = nil
                        self.show(error)
                    }
                }
            }
        } catch { show(error) }
    }

    private func show(_ error: Error) {
        if let networkError = error as? NWError, case .posix(.EADDRINUSE) = networkError {
            let alert = NSAlert()
            alert.messageText = "Локальный порт «Поля» уже занят"
            alert.informativeText = "Если открыта другая копия «Поля», переключись на неё и заверши её через ⌘Q. Затем вернись сюда и нажми «Повторить»."
            alert.addButton(withTitle: "Повторить")
            alert.addButton(withTitle: "Закрыть")
            if alert.runModal() == .alertFirstButtonReturn {
                DispatchQueue.main.async { [weak self] in self?.startServer() }
            } else {
                NSApp.terminate(nil)
            }
            return
        }
        let alert = NSAlert(error: error)
        alert.messageText = "Не удалось открыть Поля"
        if alert.informativeText.isEmpty { alert.informativeText = error.localizedDescription }
        alert.runModal()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "notesFullscreen", message.frameInfo.isMainFrame,
              let requested = message.body as? Bool, let window else { return }
        if requested != window.styleMask.contains(.fullScreen) { window.toggleFullScreen(nil) }
    }

    func windowDidEnterFullScreen(_ notification: Notification) { updateFullscreen(true) }
    func windowDidExitFullScreen(_ notification: Notification) { updateFullscreen(false) }

    private func updateFullscreen(_ enabled: Bool) {
        view?.evaluateJavaScript("window.notesFullscreenChanged?.(\(enabled));")
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if url.host == origin.host && url.port == origin.port && url.scheme == origin.scheme {
            decisionHandler(.allow)
        } else {
            if action.navigationType == .linkActivated && ["https", "http"].contains(url.scheme) {
                NSWorkspace.shared.open(url)
            }
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.begin { result in completionHandler(result == .OK ? panel.url : nil) }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        panel.begin { result in completionHandler(result == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "Подтвердить")
        alert.addButton(withTitle: "Отмена")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }
}

let app = NSApplication.shared
let delegate = NotesApp()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
