/**
 * Serviço de exportação de dados em CSV e PDF
 */

export interface ExportOptions {
  filename?: string;
  includeTimestamp?: boolean;
}

export class ExportService {
  /**
   * Exporta dados para CSV
   */
  static exportToCSV(data: any[], filename = 'export', includeTimestamp = true): void {
    if (!data || data.length === 0) {
      console.warn('Nenhum dado para exportar');
      return;
    }

    // Obter headers
    const headers = Object.keys(data[0]);

    // Criar conteúdo CSV
    let csvContent = headers.join(',') + '\n';

    // Adicionar linhas
    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header];
        // Escape para valores com vírgula ou aspas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += values.join(',') + '\n';
    });

    // Download
    this.downloadFile(csvContent, `${filename}${includeTimestamp ? '_' + this.getTimestamp() : ''}.csv`, 'text/csv');
  }

  /**
   * Exporta dados de card para CSV
   */
  static exportCardToCSV(
    cardTitle: string,
    data: Record<string, any>,
    options: ExportOptions = {}
  ): void {
    const { filename = cardTitle.toLowerCase().replace(/\s+/g, '-'), includeTimestamp = true } = options;

    // Converter objeto para array de linhas
    const csvLines: string[] = [];

    // Adicionar título
    csvLines.push(`${cardTitle}\n`);

    // Adicionar timestamp
    if (includeTimestamp) {
      csvLines.push(`Exportado em: ${new Date().toLocaleString('pt-BR')}\n`);
    }

    // Processar dados
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        csvLines.push(`\n${key}:`);
        if (value.length > 0 && typeof value[0] === 'object') {
          const headers = Object.keys(value[0]);
          csvLines.push(headers.join(','));
          value.forEach((item) => {
            const values = headers.map((h) => item[h]);
            csvLines.push(values.join(','));
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        csvLines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        csvLines.push(`${key}: ${value}`);
      }
    });

    const csvContent = csvLines.join('\n');
    this.downloadFile(csvContent, `${filename}${includeTimestamp ? '_' + this.getTimestamp() : ''}.csv`, 'text/csv');
  }

  /**
   * Exporta tabela para CSV
   */
  static exportTableToCSV(
    tableElement: HTMLTableElement,
    filename = 'export',
    includeTimestamp = true
  ): void {
    const rows: string[] = [];

    // Headers
    const headers: string[] = [];
    tableElement.querySelectorAll('thead th').forEach((th) => {
      headers.push(this.escapeCSV(th.textContent || ''));
    });
    rows.push(headers.join(','));

    // Dados
    tableElement.querySelectorAll('tbody tr').forEach((tr) => {
      const rowData: string[] = [];
      tr.querySelectorAll('td').forEach((td) => {
        rowData.push(this.escapeCSV(td.textContent || ''));
      });
      rows.push(rowData.join(','));
    });

    const csvContent = rows.join('\n');
    this.downloadFile(csvContent, `${filename}${includeTimestamp ? '_' + this.getTimestamp() : ''}.csv`, 'text/csv');
  }

  /**
   * Exporta dados para JSON
   */
  static exportToJSON(data: any[], filename = 'export', includeTimestamp = true): void {
    const json = JSON.stringify(data, null, 2);
    this.downloadFile(json, `${filename}${includeTimestamp ? '_' + this.getTimestamp() : ''}.json`, 'application/json');
  }

  /**
   * Exporta card completo para JSON
   */
  static exportCardToJSON(cardTitle: string, data: Record<string, any>, options: ExportOptions = {}): void {
    const { filename = cardTitle.toLowerCase().replace(/\s+/g, '-'), includeTimestamp = true } = options;

    const exportData = {
      title: cardTitle,
      exportedAt: new Date().toISOString(),
      ...data,
    };

    const json = JSON.stringify(exportData, null, 2);
    this.downloadFile(json, `${filename}${includeTimestamp ? '_' + this.getTimestamp() : ''}.json`, 'application/json');
  }

  /**
   * Copia dados para clipboard
   */
  static copyToClipboard(data: string, successMessage = 'Dados copiados!'): void {
    navigator.clipboard.writeText(data).then(() => {
      console.log(successMessage);
    });
  }

  /**
   * Copia tabela para clipboard (para colar em Excel/Sheets)
   */
  static copyTableToClipboard(tableElement: HTMLTableElement): void {
    const rows: string[] = [];

    tableElement.querySelectorAll('tr').forEach((tr) => {
      const rowData: string[] = [];
      tr.querySelectorAll('th, td').forEach((cell) => {
        rowData.push(cell.textContent || '');
      });
      rows.push(rowData.join('\t'));
    });

    const tabSeparated = rows.join('\n');
    this.copyToClipboard(tabSeparated, 'Tabela copiada para área de transferência!');
  }

  /**
   * Helper: Escape CSV
   */
  private static escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Helper: Download file
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Helper: Gera timestamp
   */
  private static getTimestamp(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Imprime relatório de dashboard
   */
  static printReport(
    title: string,
    content: string,
    options: { includeFooter?: boolean; includeDate?: boolean } = {}
  ): void {
    const { includeFooter = true, includeDate = true } = options;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) {
      console.error('Não foi possível abrir janela de impressão');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #0f172a; }
            .date { color: #94a3b8; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            th { background: #f8fafc; font-weight: 600; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${includeDate ? `<p class="date">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>` : ''}
          ${content}
          ${
            includeFooter
              ? `<div class="footer"><p>Dashboard Vivera - Inteligência Empresarial</p></div>`
              : ''
          }
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

export default ExportService;
