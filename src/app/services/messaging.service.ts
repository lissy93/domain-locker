// src/app/services/global-message.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Message } from 'primeng/api';

interface MessageOptions {
  position?: string;
  life?: number;
}

@Injectable({
  providedIn: 'root',
})
export class GlobalMessageService {
  private messageSubject = new BehaviorSubject<Message | null>(null);

  public getMessage(): Observable<Message | null> {
    return this.messageSubject.asObservable();
  }

  public showMessage(
    message: Message,
    options?: { position?: string; life?: number },
  ): void {
    const defaultOptions = { position: 'top-right', life: 3000 };
    const finalOptions = { ...defaultOptions, ...options };
    this.messageSubject.next({ ...message, ...finalOptions });
  }

  private showTypedMessage(
    severity: string,
    summary: string,
    detail: string,
    options?: MessageOptions,
  ): void {
    this.showMessage({ severity, summary, detail }, options);
  }

  public showSuccess(summary: string, detail: string, options?: MessageOptions): void {
    this.showTypedMessage('success', summary, detail, options);
  }

  public showInfo(summary: string, detail: string, options?: MessageOptions): void {
    this.showTypedMessage('info', summary, detail, options);
  }

  public showWarn(summary: string, detail: string, options?: MessageOptions): void {
    this.showTypedMessage('warn', summary, detail, options);
  }

  public showError(summary: string, detail: string, options?: MessageOptions): void {
    this.showTypedMessage('error', summary, detail, options);
  }

  public clearMessage(): void {
    this.messageSubject.next(null);
  }
}
