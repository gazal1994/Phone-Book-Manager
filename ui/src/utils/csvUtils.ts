import Papa from 'papaparse';

export interface Contact {
  phone: string;
  name: string;
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
            return { phone, name };
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
    contacts.map((c) => ({ PhoneNumber: c.phone, Name: c.name }))
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
