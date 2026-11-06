import AppKit

let source = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
guard let image = NSImage(contentsOf: source) else { throw CocoaError(.fileReadCorruptFile) }

func raster(_ size: Int) throws -> Data {
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
                                       bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                       colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
          let context = NSGraphicsContext(bitmapImageRep: bitmap) else { throw CocoaError(.fileWriteUnknown) }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    let margin = CGFloat(size) / 16
    let side = CGFloat(size) - 2 * margin
    image.draw(in: NSRect(x: margin, y: margin, width: side, height: side))
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else { throw CocoaError(.fileWriteUnknown) }
    return png
}

func header(_ type: String, length: Int) -> Data {
    var value = UInt32(length).bigEndian
    return Data(type.utf8) + withUnsafeBytes(of: &value) { Data($0) }
}

var images = Data()
for (type, size) in [("icp4", 16), ("icp5", 32), ("ic07", 128), ("ic08", 256),
                     ("ic09", 512), ("ic11", 32), ("ic12", 64), ("ic13", 256),
                     ("ic14", 512), ("ic10", 1024)] {
    let png = try raster(size)
    images.append(header(type, length: png.count + 8))
    images.append(png)
}
try (header("icns", length: images.count + 8) + images).write(to: output)
