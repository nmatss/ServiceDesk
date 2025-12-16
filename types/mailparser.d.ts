/**
 * Type declarations for mailparser module
 */

declare module 'mailparser' {
  export interface AddressObject {
    value: Array<{
      address: string;
      name: string;
    }>;
    html: string;
    text: string;
  }

  export interface Attachment {
    type: string;
    content: Buffer;
    contentType: string;
    contentDisposition: string;
    filename?: string;
    contentId?: string;
    headers: any;
    checksum: string;
    size: number;
  }

  export interface ParsedMail {
    headers: Map<string, string | string[]>;
    subject?: string;
    from?: AddressObject;
    to?: AddressObject;
    cc?: AddressObject;
    bcc?: AddressObject;
    replyTo?: AddressObject;
    date?: Date;
    messageId?: string;
    inReplyTo?: string;
    references?: string | string[];
    html?: string | boolean;
    text?: string;
    textAsHtml?: string;
    priority?: 'high' | 'normal' | 'low';
    attachments: Attachment[];
  }

  export function simpleParser(
    source: Buffer | string,
    options?: any
  ): Promise<ParsedMail>;
}
