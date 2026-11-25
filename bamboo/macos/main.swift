import AppKit
import WebKit
import Network
import CryptoKit

let releaseRoot = "https://kopejkingeorgij09-web.github.io/BioVision/releases/zov-lesa/"
let bundleID = "org.biovision.zovlesa.mac"

final class LocalWebServer {
    private var listener: NWListener?
    private let root: URL
    init(root: URL) { self.root = root.standardizedFileURL }
    func start(_ ready: @escaping (URL) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 49191)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        listener.stateUpdateHandler = { state in
            if case .ready = state { DispatchQueue.main.async { ready(URL(string: "http://127.0.0.1:49191/bamboo/index.html")!) } }
        }
        listener.newConnectionHandler = { [weak self] connection in
            connection.start(queue: .global(qos: .userInitiated))
            connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { data, _, _, _ in
                guard let self = self, let data = data, let request = String(data: data, encoding: .utf8) else { connection.cancel(); return }
                let first = request.components(separatedBy: "\r\n").first?.components(separatedBy: " ") ?? []
                guard first.count >= 2, first[0] == "GET" || first[0] == "HEAD" else { connection.cancel(); return }
                let path = first[1].components(separatedBy: "?")[0].removingPercentEncoding ?? ""
                let file = self.root.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))).standardizedFileURL.resolvingSymlinksInPath()
                guard file.path.hasPrefix(self.root.path + "/"), let bytes = try? Data(contentsOf: file) else {
                    connection.send(content: Data("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8), completion: .contentProcessed { _ in connection.cancel() }); return
                }
                let mime = ["html":"text/html; charset=utf-8","js":"application/javascript; charset=utf-8","css":"text/css; charset=utf-8","json":"application/json","svg":"image/svg+xml","png":"image/png","webmanifest":"application/manifest+json"][file.pathExtension] ?? "application/octet-stream"
                var response = Data("HTTP/1.1 200 OK\r\nContent-Type: \(mime)\r\nContent-Length: \(bytes.count)\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n".utf8)
                if first[0] == "GET" { response.append(bytes) }
                connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
            }
        }
        listener.start(queue: .global(qos: .userInitiated))
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var server: LocalWebServer!
    var update: [String:Any]?
    var busy = false
    func applicationDidFinishLaunching(_ notification: Notification) {
        let configuration = WKWebViewConfiguration()
        if ProcessInfo.processInfo.arguments.contains("--self-test"){configuration.websiteDataStore = .nonPersistent()}
        configuration.userContentController.add(self, name: "nativeUpdate")
        configuration.userContentController.addUserScript(WKUserScript(source: "window.ZovDesktop={postMessage:function(x){window.webkit.messageHandlers.nativeUpdate.postMessage(x)}};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self;web.uiDelegate=self
        NSWorkspace.shared.notificationCenter.addObserver(self, selector:#selector(clockDidWake(_:)), name:NSWorkspace.didWakeNotification, object:nil)
        window = NSWindow(contentRect: NSRect(x:0,y:0,width:1180,height:820), styleMask:[.titled,.closable,.miniaturizable,.resizable], backing:.buffered,defer:false)
        window.title = "Зов леса"; window.minSize = NSSize(width:420,height:600); window.contentView = web; window.center(); window.makeKeyAndOrderFront(nil)
        let menu=NSMenu(),app=NSMenu(),item=NSMenuItem();item.submenu=app;menu.addItem(item)
        app.addItem(withTitle:"Настройки…",action:#selector(settings),keyEquivalent:",").target=self
        app.addItem(withTitle:"Проверить обновления…",action:#selector(checkUpdate),keyEquivalent:"").target=self
        app.addItem(.separator());app.addItem(withTitle:"Завершить Зов леса",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q")
        let edit=NSMenu(title:"Правка"),editItem=NSMenuItem(title:"Правка",action:nil,keyEquivalent:"");editItem.submenu=edit;menu.addItem(editItem)
        edit.addItem(withTitle:"Отменить",action:#selector(editHistory(_:)),keyEquivalent:"z").target=self
        let redo=edit.addItem(withTitle:"Повторить",action:#selector(editHistory(_:)),keyEquivalent:"z")
        redo.keyEquivalentModifierMask=[.command,.shift]; redo.target=self
        for (title,action,key) in [("Вырезать","cut:","x"),("Копировать","copy:","c"),("Вставить","paste:","v"),("Выбрать всё","selectAll:","a")] { edit.addItem(withTitle:title,action:Selector(action),keyEquivalent:key) }
        NSApp.applicationIconImage=NSImage(contentsOf:Bundle.main.resourceURL!.appendingPathComponent("Web/bamboo/icons/icon-512.png"));NSApp.mainMenu=menu;NSApp.activate(ignoringOtherApps:true)
        server=LocalWebServer(root:Bundle.main.resourceURL!.appendingPathComponent("Web"))
        do { try server.start { [weak self] url in self?.web.load(URLRequest(url:url)) } }
        catch { status("error","Не удалось запустить локальный интерфейс: \(error.localizedDescription)") }
    }
    @objc private func editHistory(_ item:NSMenuItem) {
        let redo=item.keyEquivalentModifierMask.contains(.shift)
        web.evaluateJavaScript("window.B?.handleHistory(\(redo)) ?? false") { value, _ in
            if value as? Bool != true {
                NSApp.sendAction(Selector(redo ? "redo:" : "undo:"),to:nil,from:item)
            }
        }
    }
    private func refreshClock() {
        web?.evaluateJavaScript("window.dispatchEvent(new Event('zov-clock-resume'));true",completionHandler:nil)
    }
    @objc func clockDidWake(_ notification:Notification){ refreshClock() }
    func applicationDidBecomeActive(_ notification:Notification){ refreshClock() }
    private var attempts=0
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){
        if ProcessInfo.processInfo.arguments.contains("--self-test"){self.testUI()}
    }
    func testUI(){
        attempts+=1
        web.evaluateJavaScript("!!window.B?.alberts?.book && !!B.get('h_read') && B.shad.plan.length > 0 && B.shad.plan.every(p => Number.isInteger(p.n) && p.w.date && p.h.date)"){value,error in
            if value as? Bool != true {if self.attempts<80{DispatchQueue.main.asyncAfter(deadline:.now()+0.25){self.testUI()}}else{fputs("FAIL: bundled Mac UI did not load\n",stderr);exit(1)};return}
            self.web.evaluateJavaScript("B.emit('change');B.put('study_alberts',AlbertsPlan.log(B.alberts.book,B.alberts.state(),35,B.today()));location.hash='#/tasks/alberts';B.render(true);JSON.stringify({pages:B.alberts.pagesOn(B.today()),habit:B.habitDone(B.get('h_read'),B.today()),title:document.querySelector('.alberts-hero h2')?.textContent,updates:!!B.nativeUpdates})"){value,error in
                guard error==nil,let text=value as? String,text.contains("\"pages\":18"),text.contains("\"habit\":true"),text.contains("\"updates\":true") else{fputs("FAIL: Mac reading/update bridge \(String(describing:value)) \(String(describing:error))\n",stderr);exit(1)}
                self.testCalendarLayout()
            }
        }
    }
    private func testCalendarLayout() {
        let checks = #"""
        (() => {
          const $ = s => document.querySelector(s);
          const check = (ok, why) => { if (!ok) throw Error(why); };
          const date=B.today();
          B.put('e_docktest',{id:'docktest',title:'Проверка календаря',start:date,end:B.add(date,1)});
          location.hash='#/tasks/calendar'; B.render(true);
          B.acts.acMode({dataset:{v:'week'}});
          const cell = () => $('[data-all="'+date+'"]');
          const line=$('.ac-col[data-col="'+date+'"] .ac-now');
          if(!document.hidden && date===B.ymd(new Date())){
            check(!!line,'current-day clock');
            const now=new Date(), seconds=now.getHours()*3600+now.getMinutes()*60+now.getSeconds();
            line.style.top='0%';
            window.dispatchEvent(new Event('zov-clock-resume'));
            check(Math.abs(parseFloat(line.style.top)*864-seconds)<2,'clock after wake');
          }
          const count = +cell().querySelector('.ac-day-count').textContent;
          check(count>=1 && !cell().querySelector('.ac-item'),'compact count');
          $('.ac-axis-label').click();
          check(cell().querySelectorAll('.ac-item').length===count,'expanded items');
          $('.ac-axis-label').click();
          check(+cell().querySelector('.ac-day-count').textContent===count,'collapse');
          check($('.ac-heading h1').textContent.includes('–'),'week dates');
          function drag(x,y) {
            const h=$('.dock-handle'), r=h.getBoundingClientRect();
            for(const [type,cx,cy] of [['pointerdown',r.x+8,r.y+8],['pointermove',x,y],['pointerup',x,y]]){
              h.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:9,isPrimary:true,button:0,clientX:cx,clientY:cy}));
            }
          }
          const frame=()=>$('.planner-frame'), box=()=>frame().getBoundingClientRect();
          drag(box().left+4,box().top+160);
          check(frame().dataset.dock==='left' && $('.planner-nav').getBoundingClientRect().right <= $('.page.ac').getBoundingClientRect().left+1,'left rail');
          check($('.planner-nav .pl-views').children.length===5 && $('.planner-nav [data-act="acSearch"]'),'controls');
          drag(box().left+200,box().top+5);
          check(frame().dataset.dock==='top','top dock');
          $('.dock-handle').click();
          check(JSON.parse(localStorage.getItem('bamboo-planner')).dock==='left','saved position');
          $('.planner-nav [data-act="plFull"]').click(); check(B.plWide,'hide menu');
          $('.planner-nav [data-act="plFull"]').click();
          const day=B.ymd(new Date());
          B.put('e_keytest',{id:'keytest',title:'Проверка Delete',start:day+'T10:00',end:day+'T11:00'});
          B.render(true);
          const card=$('.ac-item[data-id="keytest"] .ac-open');
          check(!!card,'keyboard test card');
          card.focus();
          card.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}));
          check(!B.get('e_keytest'),'Delete on focused card');
          return true;
        })()
        """#
        web.evaluateJavaScript(checks){ value,error in
            guard value as? Bool == true else {fputs("FAIL: calendar layout \(String(describing:error))\n",stderr);exit(1)}
            print("PASS: WKWebView, all-day counts, expand and collapse, dock drag in both directions, sidebar and stored position")
            self.testCalendarUndo()
        }
    }
    private func testCalendarUndo() {
        let commandZ=NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:.command,timestamp:0,
            windowNumber:window.windowNumber,context:nil,characters:"z",charactersIgnoringModifiers:"z",isARepeat:false,keyCode:6)
        guard let event=commandZ, NSApp.mainMenu?.performKeyEquivalent(with:event) == true else {
            fputs("FAIL: Command-Z menu shortcut\n",stderr);exit(1)
        }
        web.evaluateJavaScript("B.get('e_keytest')?.title === 'Проверка Delete'") { value, error in
            guard value as? Bool == true else {fputs("FAIL: calendar Command-Z \(String(describing:error))\n",stderr);exit(1)}
            print("PASS: Calendar Backspace and Command-Z through the macOS Edit menu")
            self.web.evaluateJavaScript("B.$('.planner-nav [data-act=acSearch]').click();const open=B.sheetOpen();B.closeSheet();open") { value,error in
                guard value as? Bool == true else {fputs("FAIL: calendar search \(String(describing:error))\n",stderr);exit(1)}
                self.testBoard()
            }
        }
    }
    private func testBoard() {
        let checks = #"""
        (() => {
          const saved = B.get('e_keytest');
          B.$('.ac-item[data-id=keytest] .ac-card-menu').click();
          B.$('[data-act=acBoardCopy]').click();
          B.$('[data-board-choice=active]').click();
          location.hash='#/board'; B.render(true);
          const card = B.$('[data-board-lane=active] .bd-card-title');
          return card?.textContent === saved.title && getComputedStyle(B.$('.bd-grid')).display === 'grid' &&
            B.get('e_keytest') === saved;
        })()
        """#
        web.evaluateJavaScript(checks){value,error in
            guard value as? Bool == true else {fputs("FAIL: independent board \(String(describing:error))\n",stderr);exit(1)}
            DispatchQueue.main.asyncAfter(deadline:.now()+0.5){self.web.takeSnapshot(with:nil){image,error in
                if let image=image,let tiff=image.tiffRepresentation,let bitmap=NSBitmapImageRep(data:tiff),let png=bitmap.representation(using:.png,properties:[:]){try? png.write(to:URL(fileURLWithPath:NSTemporaryDirectory()+"Zov-Lesa-macOS-preview.png"))}
                print("PASS: native macOS WKWebView, independent board, calendar search, bundled assets, Alberts reading log, Molbio habit, update bridge");exit(0)
            }}
        }
    }
    private var quitting=false
    func applicationShouldTerminate(_ sender:NSApplication)->NSApplication.TerminateReply{
        if quitting{return .terminateLater};quitting=true
        var replied=false
        let reply={if !replied{replied=true;sender.reply(toApplicationShouldTerminate:true)}}
        web.evaluateJavaScript("window.dispatchEvent(new Event('pagehide'));true"){_,_ in reply()}
        DispatchQueue.main.asyncAfter(deadline:.now()+1){reply()}
        return .terminateLater
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    @objc func settings(){web.evaluateJavaScript("location.hash='#/settings'",completionHandler:nil)}
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin=message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.host=="127.0.0.1",origin.port==49191,
            let raw=message.body as? String,let bytes=raw.data(using:.utf8),let data=(try? JSONSerialization.jsonObject(with:bytes)) as? [String:Any] else {return}
        switch data["op"] as? String { case "updateCheck":checkUpdate();case "updateInstall":installUpdate();case "updateStatus":status("idle","Проверь наличие новой версии приложения");default:break }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url=navigationAction.request.url else {decisionHandler(.cancel);return}
        if url.scheme=="http" && url.host=="127.0.0.1" && url.port==49191 {decisionHandler(.allow)}
        else {if ["https","http"].contains(url.scheme ?? ""){NSWorkspace.shared.open(url)};decisionHandler(.cancel)}
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {if let url=navigationAction.request.url, url.scheme=="https"{NSWorkspace.shared.open(url)};return nil}
    func status(_ state:String,_ message:String){
        DispatchQueue.main.async {
            let object:[String:Any] = ["status":state,"message":message,"current":Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"]
            if let data=try? JSONSerialization.data(withJSONObject:object),let json=String(data:data,encoding:.utf8){self.web.evaluateJavaScript("window.zovUpdateStatus?.(\(json))",completionHandler:nil)}
        }
    }
    @objc func checkUpdate(){
        guard !busy else{return};busy=true;settings();status("busy","Проверяю новую версию…")
        var request=URLRequest(url:URL(string:releaseRoot+"manifest.json")!);request.cachePolicy = .reloadIgnoringLocalCacheData;request.timeoutInterval=25
        URLSession.shared.dataTask(with:request){data,response,error in
            defer{self.busy=false}
            guard let data=data,let http=response as? HTTPURLResponse,http.statusCode==200,
                let feed=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],let release=feed["macos"] as? [String:Any],let build=release["build"] as? Int,
                let url=release["url"] as? String,url.hasPrefix(releaseRoot),!url.contains(".."),let hash=release["sha256"] as? String,hash.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil else {self.status("error","Не удалось проверить обновления. Попробуй позже.");return}
            let current=Int(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1") ?? 1
            if build>current {self.update=release;self.status("available","Доступна версия \(release["version"] ?? "")")}
            else {self.update=nil;self.status("current","Установлена актуальная версия")}
        }.resume()
    }
    func installUpdate(){
        guard !busy,let release=update,let string=release["url"] as? String,let url=URL(string:string),let expected=release["sha256"] as? String,let build=release["build"] as? Int else{return}
        let app=Bundle.main.bundleURL
        guard !app.path.hasPrefix("/Volumes/"),FileManager.default.isWritableFile(atPath:app.deletingLastPathComponent().path) else {status("error","Перемести приложение в свою папку «Программы», затем повтори обновление");return}
        busy=true;status("busy","Скачиваю и проверяю обновление…")
        URLSession.shared.downloadTask(with:url){temp,response,error in
            defer{self.busy=false}
            do{
                guard let temp=temp,let response=response as? HTTPURLResponse,response.statusCode==200 else{throw NSError(domain:"Update",code:1)}
                let fresh=try self.unpackArchive(temp,expected:expected,build:build)
                let dir=fresh.deletingLastPathComponent()
                let script=dir.appendingPathComponent("apply.sh")
                let source="""
                #!/bin/sh
                while kill -0 "$1" 2>/dev/null; do sleep 1; done
                backup="$4"
                if [ -e "$backup" ]; then exit 1; fi
                mv "$2" "$backup" || exit 1
                if mv "$3" "$2"; then
                    /usr/bin/open "$2"
                else
                    mv "$backup" "$2"
                fi
                """
                try source.write(to:script,atomically:true,encoding:.utf8)
                let process=Process();process.executableURL=URL(fileURLWithPath:"/bin/sh");process.arguments=[script.path,String(ProcessInfo.processInfo.processIdentifier),app.path,fresh.path,dir.appendingPathComponent("previous.app").path];try process.run()
                DispatchQueue.main.async{NSApp.terminate(nil)}
            }catch {self.status("error","Не удалось установить обновление. Текущая версия сохранена.")}
        }.resume()
    }
    func unpackArchive(_ archiveURL:URL,expected:String,build:Int)throws->URL{
        let bytes=try Data(contentsOf:archiveURL)
        guard bytes.count<40_000_000,SHA256.hash(data:bytes).map({String(format:"%02x",$0)}).joined()==expected else{throw NSError(domain:"Checksum",code:1)}
        let dir=FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent(bundleID+"/update-"+UUID().uuidString)
        try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
        let archive=dir.appendingPathComponent("update.zip");try bytes.write(to:archive)
        try run("/usr/bin/ditto",["-x","-k",archive.path,dir.path])
        let fresh=dir.appendingPathComponent("Зов леса.app")
        guard let bundle=Bundle(url:fresh),bundle.bundleIdentifier==bundleID,Int(bundle.infoDictionary?["CFBundleVersion"] as? String ?? "0")==build else{throw NSError(domain:"Package",code:1)}
        try run("/usr/bin/codesign",["--verify","--deep","--strict",fresh.path]);return fresh
    }
    func run(_ executable:String,_ arguments:[String])throws{let task=Process();task.executableURL=URL(fileURLWithPath:executable);task.arguments=arguments;try task.run();task.waitUntilExit();if task.terminationStatus != 0{throw NSError(domain:"Process",code:Int(task.terminationStatus))}}
}
let args=ProcessInfo.processInfo.arguments
if args.count==5 && args[1]=="--verify-archive" {
    do{_ = try AppDelegate().unpackArchive(URL(fileURLWithPath:args[2]),expected:args[3],build:Int(args[4]) ?? 0);print("PASS: archive hash, app identity, version and code signature");exit(0)}catch{fputs("REJECTED: \(error)\n",stderr);exit(1)}
}
let app=NSApplication.shared
let delegate=AppDelegate()
app.delegate=delegate
app.run()
