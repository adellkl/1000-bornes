import { Check, Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

interface QRCodeShareProps {
  url: string
  title?: string
  caption?: string
  size?: number
}

/** QR code + lien copiable pour rejoindre depuis un téléphone */
export function QRCodeShare({ url, title = 'Scannez pour rejoindre', caption, size = 220 }: QRCodeShareProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copiez ce lien :', url)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-xs font-bold uppercase tracking-wider text-night-300">{title}</div>
      <div className="rounded-3xl bg-cream-50 p-4 shadow-[0_20px_50px_-20px_rgb(246_194_28/0.5)] ring-4 ring-signal-400">
        <QRCodeSVG value={url} size={size} bgColor="#fbf6ea" fgColor="#0b1626" level="M" marginSize={0} />
      </div>
      {caption && <p className="max-w-xs text-sm text-night-300">{caption}</p>}
      <button
        type="button"
        onClick={copy}
        className="inline-flex max-w-full items-center gap-2 rounded-full bg-night-800 px-4 py-2 text-sm font-bold ring-1 ring-cream-100/15 hover:bg-night-700"
      >
        {copied ? <Check className="size-4 text-go-400" /> : <Copy className="size-4 text-signal-400" />}
        <span className="truncate">{copied ? 'Lien copié !' : url.replace(/^https?:\/\//, '')}</span>
      </button>
    </div>
  )
}
