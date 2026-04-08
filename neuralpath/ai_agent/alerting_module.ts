import nodemailer from "nodemailer"

export interface AlertConfig {
  email?: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    to: string[]
    secure?: boolean
  }
  console?: boolean
  prefix?: string
}

export interface AlertSignal {
  title: string
  message: string
  level: "info" | "warning" | "critical"
  timestamp?: number
}

export class AlertService {
  constructor(private cfg: AlertConfig) {}

  private async sendEmail(signal: AlertSignal) {
    if (!this.cfg.email) return
    const { host, port, user, pass, from, to, secure } = this.cfg.email
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure ?? port === 465,
      auth: { user, pass },
    })
    await transporter.sendMail({
      from,
      to,
      subject: this.buildSubject(signal),
      text: this.buildBody(signal),
    })
  }

  private logConsole(signal: AlertSignal) {
    if (!this.cfg.console) return
    const header = `[Alert][${signal.level.toUpperCase()}] ${signal.title}`
    const body = signal.message
    const time = signal.timestamp ? new Date(signal.timestamp).toISOString() : new Date().toISOString()
    const prefix = this.cfg.prefix ? `[${this.cfg.prefix}]` : ""
    console.log(`${prefix}${header} @ ${time}\n${body}`)
  }

  async dispatch(signals: AlertSignal[]) {
    for (const sig of signals) {
      const enriched = { ...sig, timestamp: sig.timestamp ?? Date.now() }
      await this.sendEmail(enriched)
      this.logConsole(enriched)
    }
  }

  private buildSubject(signal: AlertSignal): string {
    const prefix = this.cfg.prefix ? `[${this.cfg.prefix}] ` : ""
    return `${prefix}[${signal.level.toUpperCase()}] ${signal.title}`
  }

  private buildBody(signal: AlertSignal): string {
    const time = signal.timestamp ? new Date(signal.timestamp).toLocaleString() : new Date().toLocaleString()
    return `Time: ${time}\nLevel: ${signal.level}\n\n${signal.message}`
  }
}
