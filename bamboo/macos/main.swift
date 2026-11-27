import AppKit
import WebKit
import Network
import CryptoKit
import WidgetKit
import UserNotifications

let releaseRoot = "https://kopejkingeorgij09-web.github.io/BioVision/releases/zov-lesa/"
let bundleID = "org.biovision.zovlesa.mac"

final class LocalWebServer {
    private var listener: NWListener?
    private let root: URL
    private let preferredPort: UInt16
    private(set) var port: UInt16
    init(root: URL, port: UInt16 = 49191) {
        self.root = root.standardizedFileURL
        self.preferredPort = port
        self.port = port
    }
    func start(_ completion: @escaping (Result<URL, Error>) -> Void) throws {
        let parameters = NWParameters.tcp
        let endpointPort: NWEndpoint.Port = preferredPort == 0 ? .any : NWEndpoint.Port(rawValue: preferredPort)!
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: endpointPort)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        var settled = false
        listener.stateUpdateHandler = { [weak self] state in
            guard let self = self, !settled else { return }
            switch state {
            case .ready:
                settled = true
                let actual = listener.port?.rawValue ?? self.preferredPort
                self.port = actual
                DispatchQueue.main.async { completion(.success(URL(string: "http://127.0.0.1:\(actual)/bamboo/index.html")!)) }
            case .failed(let error):
                settled = true
                DispatchQueue.main.async { completion(.failure(error)) }
            default:
                break
            }
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
                let mime = ["html":"text/html; charset=utf-8","js":"application/javascript; charset=utf-8","css":"text/css; charset=utf-8","json":"application/json","svg":"image/svg+xml","png":"image/png","jpg":"image/jpeg","m4a":"audio/mp4","webmanifest":"application/manifest+json"][file.pathExtension] ?? "application/octet-stream"
                let cache = path.hasPrefix("/bamboo/focus/scenes/") ? "private, max-age=86400" : "no-store"
                var response = Data("HTTP/1.1 200 OK\r\nContent-Type: \(mime)\r\nContent-Length: \(bytes.count)\r\nCache-Control: \(cache)\r\nConnection: close\r\n\r\n".utf8)
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
    private var focusItem: NSStatusItem?
    private var requestedFocus: String?
    @objc private func showFocus(){
        openFocus("studio")
    }
    private func openFocus(_ section:String){
        guard ["studio","week","plan"].contains(section) else{return}
        requestedFocus=section
        NSApp.activate(ignoringOtherApps:true)
        window?.makeKeyAndOrderFront(nil)
        if web?.url != nil {
            web.evaluateJavaScript("location.hash='#/board/focus/\(section)';true"){ _,error in
                if error == nil && self.requestedFocus==section { self.requestedFocus=nil }
            }
        }
    }
    func application(_ application:NSApplication, open urls:[URL]){
        if let link=urls.last(where:{$0.scheme=="zovfocus"}), let section=link.host {openFocus(section)}
    }
    func applicationShouldHandleReopen(_ sender:NSApplication,hasVisibleWindows flag:Bool)->Bool{
        window?.makeKeyAndOrderFront(nil)
        return true
    }
    @objc private func focusToggle(){web.evaluateJavaScript("B.acts.focusToggle();true",completionHandler:nil)}
    @objc private func focusSound(){web.evaluateJavaScript("B.acts.focusSound();true",completionHandler:nil)}
    private func focusClock(_ label:String){
        if label.isEmpty {
            if let item=focusItem {NSStatusBar.system.removeStatusItem(item);focusItem=nil}
            return
        }
        if focusItem==nil {
            let item=NSStatusBar.system.statusItem(withLength:NSStatusItem.variableLength)
            let menu=NSMenu()
            for (title,action) in [("Открыть фокус",#selector(showFocus)),("Пауза / продолжить",#selector(focusToggle)),("Включить / выключить фон",#selector(focusSound))] {
                menu.addItem(withTitle:title,action:action,keyEquivalent:"").target=self
            }
            item.menu=menu
            item.button?.font=NSFont.monospacedDigitSystemFont(ofSize:12,weight:.medium)
            focusItem=item
        }
        focusItem?.button?.title="◷ "+String(label.prefix(12))
    }
    private var focusAlertDeadline=0.0
    private var focusAlertTitle="Фокус"
    private var focusAlertSound=false
    private func updateFocusAlert(_ snapshot:[String:Any], force:Bool=false){
        let until=snapshot["notify"] as? Bool == true ? (snapshot["until"] as? Double ?? 0)/1000 : 0
        let title=snapshot["title"] as? String ?? "Фокус"
        let sound=snapshot["chime"] as? Bool ?? true
        guard force || until != focusAlertDeadline || title != focusAlertTitle || sound != focusAlertSound else{return}
        focusAlertDeadline=until
        focusAlertTitle=title
        focusAlertSound=sound
        let center=UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers:["zov.focus"])
        let delay=until-Date().timeIntervalSince1970
        guard delay>0,delay<=10801 else{return}
        let content=UNMutableNotificationContent()
        content.title="Таймер завершён"
        content.body=title
        if sound {content.sound = .default}
        let trigger=UNTimeIntervalNotificationTrigger(timeInterval:max(1,delay),repeats:false)
        center.add(UNNotificationRequest(identifier:"zov.focus",content:content,trigger:trigger))
    }
    private func focusWidget(_ data:[String:Any]){
        guard !ProcessInfo.processInfo.arguments.contains("--self-test"), let snapshot=data["snapshot"] as? [String:Any] else{return}
        updateFocusAlert(snapshot)
        guard let bytes=try? JSONSerialization.data(withJSONObject:snapshot), bytes.count<20000,
              let dir=FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:"group.org.biovision.zovlesa.focus")
        else{return}
        do{
            try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
            try bytes.write(to:dir.appendingPathComponent("focus.json"),options:.atomic)
            WidgetCenter.shared.reloadTimelines(ofKind:"ZovFocus")
        }catch{NSLog("Не удалось обновить виджет фокуса")}
    }
    var busy = false
    func applicationDidFinishLaunching(_ notification: Notification) {
        let selfTest = ProcessInfo.processInfo.arguments.contains("--self-test")
        if !selfTest {
            let others = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).filter { $0 != NSRunningApplication.current }
            if let existing = others.first {
                existing.activate(options: .activateIgnoringOtherApps)
                NSApp.terminate(nil)
                return
            }
            cleanupOldUpdates()
        }
        let configuration = WKWebViewConfiguration()
        if selfTest { configuration.websiteDataStore = .nonPersistent() }
        configuration.userContentController.add(self, name: "nativeUpdate")
        configuration.userContentController.addUserScript(WKUserScript(source: "window.ZOV_BUNDLED=true;window.ZovDesktop={postMessage:function(x){window.webkit.messageHandlers.nativeUpdate.postMessage(x)}};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self;web.uiDelegate=self
        NSWorkspace.shared.notificationCenter.addObserver(self, selector:#selector(clockDidWake(_:)), name:NSWorkspace.didWakeNotification, object:nil)
        window = NSWindow(contentRect: NSRect(x:0,y:0,width:1180,height:820), styleMask:[.titled,.closable,.miniaturizable,.resizable], backing:.buffered,defer:false)
        window.isReleasedWhenClosed=false
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
        server=LocalWebServer(root:Bundle.main.resourceURL!.appendingPathComponent("Web"), port: selfTest ? 0 : 49191)
        do {
            try server.start { [weak self] result in
                switch result {
                case .success(let url): self?.web.load(URLRequest(url: url))
                case .failure(let error): self?.status("error", "Не удалось запустить локальный интерфейс: \(error.localizedDescription)")
                }
            }
        }
        catch { status("error","Не удалось запустить локальный интерфейс: \(error.localizedDescription)") }
    }
    private func cleanupOldUpdates() {
        let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent(bundleID)
        guard let entries = try? FileManager.default.contentsOfDirectory(at: cache, includingPropertiesForKeys: nil) else { return }
        for url in entries where url.lastPathComponent.hasPrefix("update-") {
            try? FileManager.default.removeItem(at: url)
        }
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
        if let section=requestedFocus {openFocus(section)}
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
          B.calendarView.selectDate(date);
          B.put('e_docktest',{id:'docktest',title:'Проверка календаря',start:date,end:B.add(date,1)});
          location.hash='#/tasks/week'; B.render(true);
          function drag(x,y) {
            const h=$('.dock-handle'), r=h.getBoundingClientRect();
            for(const [type,cx,cy] of [['pointerdown',r.x+8,r.y+8],['pointermove',x,y],['pointerup',x,y]]){
              h.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:9,isPrimary:true,button:0,clientX:cx,clientY:cy}));
            }
          }
          const frame=()=>$('.planner-frame'), box=()=>frame().getBoundingClientRect();
          drag(box().left+4,box().top+160);
          check(frame().dataset.dock==='left' && $('.planner-nav').getBoundingClientRect().right <= $('.page.planner').getBoundingClientRect().left+1,'left rail');
          check($('.planner-nav .pl-views').children.length===4,'planner controls');
          drag(box().left+200,box().top+5);
          check(frame().dataset.dock==='top','top dock');
          $('.dock-handle').click();
          check(JSON.parse(localStorage.getItem('bamboo-planner')).dock==='left','saved position');
          const plannerEvent=$('.planner [data-act="acOpen"][data-id="docktest"]');
          check(!!plannerEvent,'calendar event in Tasks');
          plannerEvent.focus();
          const removeKey=new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true});
          plannerEvent.dispatchEvent(removeKey);
          check(removeKey.defaultPrevented && !B.get('e_docktest') && location.hash==='#/tasks/week','Tasks Backspace consumes native Back and deletes event');
          $('[data-act="undoHistoryStep"]').click();
          check(!!B.get('e_docktest'),'Tasks deletion can be undone');
          location.hash='#/calendar'; B.render(true);
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
          check($('.ac-toolbar [data-act="acSearch"]') && $('.ac-toolbar [data-act="plFull"]'),'calendar controls');
          $('.ac-toolbar [data-act="plFull"]').click(); check(B.plWide,'hide menu');
          $('.ac-toolbar [data-act="plFull"]').click();
          B.put('e_keytest',{id:'keytest',type:'task',title:'Проверка Delete',start:date+'T10:00',end:date+'T11:00'});
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
            self.web.evaluateJavaScript("B.$('.ac-toolbar [data-act=acSearch]').click();const open=B.sheetOpen();B.closeSheet();open") { value,error in
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
            B.boardData.get(card.dataset.id)?.ref === saved.id && B.get('e_keytest') === saved;
        })()
        """#
        web.evaluateJavaScript(checks){value,error in
            guard value as? Bool == true else {fputs("FAIL: linked board \(String(describing:error))\n",stderr);exit(1)}
            DispatchQueue.main.asyncAfter(deadline:.now()+0.5){self.web.takeSnapshot(with:nil){image,error in
                if let image=image,let tiff=image.tiffRepresentation,let bitmap=NSBitmapImageRep(data:tiff),let png=bitmap.representation(using:.png,properties:[:]){try? png.write(to:URL(fileURLWithPath:NSTemporaryDirectory()+"Zov-Lesa-macOS-preview.png"))}
                print("PASS: native macOS WKWebView, linked board, calendar search, bundled assets, Alberts reading log, Molbio habit, update bridge")
                self.testEntryEditor()
            }}
        }
    }
    private func testEntryEditor() {
        let checks = #"""
        const $ = s => document.querySelector(s);
        const wait = () => new Promise(resolve => setTimeout(resolve, 220));
        const day = B.today();
        location.hash = '#/calendar';
        await wait();
        B.calendarView.selectDate(day);
        B.acts.acMode({dataset:{v:'day'}});
        const col = $('[data-col="'+day+'"]');
        col.closest('.ac-scroll').scrollTop = col.offsetHeight * 8/24;
        const grid = col.getBoundingClientRect();
        col.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientY:grid.top + grid.height * (10 + 59/60) / 24}));
        const slot = $('#acEditor');
        if (slot.elements.startAt.value !== day+'T10:00' || slot.elements.endAt.value !== day+'T11:00') throw Error('Hour slot');
        const card = $('.ac-draft').getBoundingClientRect(), panel = $('#sheet').getBoundingClientRect();
        if (!$('#scrim').dataset.acSide || (panel.left < card.right && panel.right > card.left)) throw Error('Calendar editor overlaps card');
        B.closeSheet();
        await wait();
        const refreshedCol = $('[data-col="'+day+'"]'), bounds = refreshedCol.getBoundingClientRect();
        refreshedCol.dispatchEvent(new MouseEvent('contextmenu',{button:2,bubbles:true,cancelable:true,clientY:bounds.top+bounds.height*(11+59/60)/24}));
        $('.ac-create-menu [data-kind=task]').click();
        const task = $('#acEditor');
        if (task.elements.startAt.value !== day+'T11:00' || task.elements.endAt.value !== day+'T12:00' ||
            !task.querySelector('[data-v=task][aria-pressed=true]') || !$('#scrim').dataset.acSide) throw Error('Task context slot');
        B.closeSheet();
        await wait();
        const cell = $('[data-all="'+day+'"]');
        cell.dispatchEvent(new MouseEvent('contextmenu',{button:2,bubbles:true,cancelable:true}));
        $('.ac-create-menu [data-kind=event]').click();
        const form = $('form.entry-editor');
        form.elements.title.value = 'Тест общей карточки';
        form.querySelector('[type=submit]').click();
        await wait();
        const record = B.calData.events().find(e => e.title === 'Тест общей карточки');
        if (!record || record.start !== day) throw Error('Incorrect calendar day');
        location.hash = '#/tasks/week';
        await wait();
        $('.planner [data-act=acOpen][data-id="'+record.id+'"]').click();
        const reopened = $('form.entry-editor');
        if (reopened.elements.title.value !== record.title) throw Error('Different record in planner');
        reopened.elements.notes.value = 'Изменено из задач';
        reopened.querySelector('[type=submit]').click();
        await wait();
        if (B.get('e_'+record.id)?.notes !== 'Изменено из задач') throw Error('Lost planner edit');
        return true;
        """#
        web.callAsyncJavaScript(checks, arguments:[:], in:nil, in:.page) { result in
            guard case .success(let value) = result, value as? Bool == true else {
                fputs("FAIL: macOS shared calendar editor \(result)\n", stderr);exit(1)
            }
            print("PASS: WKWebView calendar context menu, create event and edit from Tasks")
            self.testFocusStudio()
        }
    }
    private func testFocusStudio() {
        let checks = #"""
        const $ = selector => document.querySelector(selector);
        const check = (ok, detail) => { if (!ok) throw Error(detail); };
        const click = selector => {
          const button = $(selector);
          check(button && !button.disabled, selector);
          button.click();
        };
        location.hash = '#/board/focus/studio';
        B.render(true);
        check(document.querySelectorAll('.fr-nav a').length === 2, 'studio navigation');
        B.saveTask(B.newTask({id:'focus-link-check',title:'Дело для фокуса',due:B.today()}));
        location.hash='#/board'; B.render(true);
        click('[data-act=focusStartCard][data-id="task:focus-link-check"]');
        B.render(true);
        const linked=B.focus.current().timer.id;
        check($('.bd-active .bd-in-focus') && $('.bd-focus-session').textContent.includes('Дело для фокуса'),'linked board session');
        click('.bd-focus-session [data-act=focusToggle]');
        location.hash='#/board/focus/studio'; B.render(true);
        check(B.focus.current().timer.id===linked && !B.focus.current().timer.running && $('.fr-task-title').textContent.includes('Дело для фокуса'),'linked studio session');
        click('[data-act=focusReset]'); B.render(true);
        for (const mode of ['timer', 'pomo']) {
          click('[data-mode="' + mode + '"]');
          click('[data-act=focusToggle]');
          check(B.focus.current()?.timer.mode === mode && B.focus.current().timer.running, mode + ' start');
          click('[data-act=focusToggle]');
          check(!B.focus.current().timer.running && B.focus.current().timer.left > 0, mode + ' pause');
          B.render(true);
          click('[data-act=focusReset]');
          check(!B.focus.current().timer, mode + ' reset');
        }
        click('.fr-quick summary');
        check($('.fr-quick').open && $('.fr-pop input[type=range]'), 'quick mixer');
        location.hash = '#/board/focus/customize';
        B.render(true);
        check(document.querySelectorAll('.fr-gallery [data-scene]').length === 10, 'all themes');
        const gallery=$('.fr-gallery'), space=$('.fr-scene[data-scene=carina]');
        space.click();
        click('.fr-channel-grid [data-act=focusMute]');
        B.render(true);
        check(gallery===$('.fr-gallery') && space===$('.fr-scene[data-scene=carina]') && space.getAttribute('aria-pressed')==='true','persistent gallery');
        check(document.querySelectorAll('.fr-channel-grid input').length === 8, 'all audio channels');
        const ctx = new AudioContext();
        try {
          for (const channel of ['fireplace','rain','forest','brown','white','chime']) {
            const response = await fetch('focus/audio/' + channel + '.m4a');
            check(response.ok, channel + ' bundled');
            const audio = await ctx.decodeAudioData(await response.arrayBuffer());
            check(audio.duration > 1 && audio.numberOfChannels > 0, channel + ' decode');
          }
        } finally { await ctx.close(); }
        return true;
        """#
        web.callAsyncJavaScript(checks, arguments:[:], in:nil, in:.page) { result in
            switch result {
            case .success(let value) where value as? Bool == true:
                print("PASS: WKWebView timer and Pomodoro start/pause/reset, quick mixer, themes and bundled Web Audio decoding");exit(0)
            default: fputs("FAIL: macOS focus studio \(result)\n",stderr);exit(1)
            }
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
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { focusItem == nil }
    @objc func settings(){web.evaluateJavaScript("location.hash='#/settings'",completionHandler:nil)}
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin=message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.host=="127.0.0.1", origin.port == Int(server.port),
            let raw=message.body as? String,let bytes=raw.data(using:.utf8),let data=(try? JSONSerialization.jsonObject(with:bytes)) as? [String:Any] else {return}
        switch data["op"] as? String {
        case "focusNotifyEnable":
            UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.sound]) {granted,_ in
                if granted {DispatchQueue.main.async {
                    self.updateFocusAlert(["notify":true,"until":self.focusAlertDeadline*1000,
                        "title":self.focusAlertTitle,"chime":self.focusAlertSound], force:true)
                }}
            }
        case "focusClock":focusClock(data["label"] as? String ?? "")
        case "focusWidget":focusWidget(data)
        case "updateCheck":checkUpdate()
        case "updateInstall":installUpdate()
        case "updateStatus":status("idle","Проверь наличие новой версии приложения")
        default:break
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url=navigationAction.request.url else {decisionHandler(.cancel);return}
        if url.scheme=="http" && url.host=="127.0.0.1" && url.port == Int(server.port) {decisionHandler(.allow)}
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
            guard let data=data,let http=response as? HTTPURLResponse,http.statusCode==200,
                let feed=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],let release=feed["macos"] as? [String:Any],let build=release["build"] as? Int,
                let url=release["url"] as? String,url.hasPrefix(releaseRoot),!url.contains(".."),let hash=release["sha256"] as? String,hash.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil else {
                DispatchQueue.main.async{self.busy=false;self.status("error","Не удалось проверить обновления. Попробуй позже.")}
                return
            }
            let current=Int(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1") ?? 1
            DispatchQueue.main.async {
                self.busy=false
                if build>current {self.update=release;self.status("available","Доступна версия \(release["version"] ?? "")")}
                else {self.update=nil;self.status("current","Установлена актуальная версия")}
            }
        }.resume()
    }
    func installUpdate(){
        guard !busy,let release=update,let string=release["url"] as? String,let url=URL(string:string),let expected=release["sha256"] as? String,let build=release["build"] as? Int else{return}
        let app=Bundle.main.bundleURL
        guard !app.path.hasPrefix("/Volumes/"),FileManager.default.isWritableFile(atPath:app.deletingLastPathComponent().path) else {status("error","Перемести приложение в свою папку «Программы», затем повтори обновление");return}
        busy=true;status("busy","Скачиваю и проверяю обновление…")
        URLSession.shared.downloadTask(with:url){temp,response,error in
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
                DispatchQueue.main.async{self.busy=false;NSApp.terminate(nil)}
            }catch {DispatchQueue.main.async{self.busy=false;self.status("error","Не удалось установить обновление. Текущая версия сохранена.")}}
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
