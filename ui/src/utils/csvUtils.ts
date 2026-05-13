import Papa from 'papaparse';

export type ContactCategory = 'Family' | 'Work' | 'VIP' | 'Other';

export interface Contact {
  phone: string;
  name: string;
  tags?: string[];
  notes?: string;
  category?: ContactCategory;
}

export function parsePhoneBookCSV(file: File): Promise<Contact[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const contacts: Contact[] = (results.data as Record<string, string>[])
          .map((row) => {
            const phone = (row['PhoneNumber'] ?? row['phonenumber'] ?? row['phone'] ?? '').toString().trim();
            const name = (row['Name'] ?? row['name'] ?? '').toString().trim();
            const tagsRaw = (row['Tags'] ?? row['tags'] ?? '').toString().trim();
            const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
            const notes = (row['Notes'] ?? row['notes'] ?? '').toString().trim() || undefined;
            const catRaw = (row['Category'] ?? row['category'] ?? '').toString().trim();
            const category = (['Family', 'Work', 'VIP', 'Other'].includes(catRaw) ? catRaw : undefined) as ContactCategory | undefined;
            return { phone, name, tags, notes, category };
          })
          .filter((c) => c.phone !== '');
        resolve(contacts);
      },
      error: (err) => reject(err),
    });
  });
}

export function exportPhoneBookCSV(contacts: Contact[]): void {
  const csv = Papa.unparse(
    contacts.map((c) => ({
      PhoneNumber: c.phone,
      Name: c.name,
      Category: c.category ?? '',
      Tags: (c.tags ?? []).join(','),
      Notes: c.notes ?? '',
    }))
  );
  downloadText(csv, 'phone_book.csv', 'text/csv');
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
