import SwiftUI
import WidgetKit

struct FocusEntry: TimelineEntry {
    let date: Date
    var title = "Фокус"
    var until = 0.0
    var clock = "25:00"
    var plan = [String]()
    var week = [Int]()
    var scene = "forest"
}
struct FocusProvider: TimelineProvider {
    func placeholder(in context: Context) -> FocusEntry { FocusEntry(date: Date()) }
    func load() -> FocusEntry {
        var row = FocusEntry(date: Date())
        guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.org.biovision.zovlesa.focus"),
              let bytes = try? Data(contentsOf: dir.appendingPathComponent("focus.json")),
              let obj = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any] else { return row }
        row.title = obj["title"] as? String ?? row.title
        row.clock = obj["clock"] as? String ?? row.clock
        row.until = (obj["until"] as? Double ?? 0) / 1000
        row.plan = obj["plan"] as? [String] ?? []
        row.week = obj["week"] as? [Int] ?? []
        row.scene = obj["scene"] as? String ?? row.scene
        return row
    }
    func getSnapshot(in context: Context, completion: @escaping (FocusEntry) -> Void) { completion(load()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<FocusEntry>) -> Void) {
        let row = load()
        completion(Timeline(entries: [row], policy: .never))
    }
}
struct FocusFace: View {
    @Environment(\.widgetFamily) var family
    let entry: FocusEntry
    var background: Color {
        switch entry.scene {
        case "amber_evening", "terracotta": return Color(red: 0.30, green: 0.18, blue: 0.11)
        case "pink_mist", "lavender_dusk": return Color(red: 0.33, green: 0.21, blue: 0.34)
        case "sea_glass", "lake_dawn", "polar_night", "alpine_snow": return Color(red: 0.12, green: 0.23, blue: 0.33)
        default: return Color(red: 0.12, green: 0.26, blue: 0.20)
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.title).font(.headline).lineLimit(1)
            if entry.until > entry.date.timeIntervalSince1970 {
                Text(timerInterval: entry.date...Date(timeIntervalSince1970: entry.until), countsDown: true)
                    .font(.largeTitle.monospacedDigit())
            } else { Text(entry.until > 0 ? "00:00" : entry.clock).font(.largeTitle.monospacedDigit()) }
            if family != .systemSmall {
                ForEach(Array(entry.plan.prefix(3).enumerated()), id: \.offset) { _, title in Text(title).lineLimit(1) }
            }
            if family == .systemLarge {
                Text("Фокус за 7 дней · \(entry.week.reduce(0,+)) мин").font(.headline)
                HStack(alignment: .bottom) {
                    ForEach(Array(entry.week.enumerated()), id: \.offset) { _, n in
                        VStack {Text("\(n)").font(.caption); Capsule().frame(height: CGFloat(2 + 55*n/max(1,entry.week.max() ?? 1)))}
                    }
                }
            }
        }.frame(maxWidth:.infinity,alignment:.leading).foregroundStyle(.white)
            .containerBackground(background, for:.widget).widgetURL(URL(string:"zovfocus://studio"))
    }
}
@main struct FocusWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ZovFocus", provider: FocusProvider()) { entry in FocusFace(entry:entry) }
            .configurationDisplayName("Фокус · Зов леса").description("Таймер, дела на сегодня и минуты фокуса за неделю.")
            .supportedFamilies([.systemSmall,.systemMedium,.systemLarge])
    }
}
