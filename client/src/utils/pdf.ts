import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Delivery, DELIVERY_STATUS_LABELS, CHECKLIST_ITEMS } from '../types';

export function generatePDF(delivery: Delivery) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Wareneingangsbeleg', margin, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('IT Service GmbH — Warenannahme', margin, 20);
  doc.text(`Erstellt: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageWidth - margin, 12, { align: 'right' });
  doc.text(`Dokument-Nr.: WE-${delivery.id.slice(0, 8).toUpperCase()}`, pageWidth - margin, 20, { align: 'right' });

  let y = 38;
  doc.setTextColor(0, 0, 0);

  // Status banner
  const statusColor = delivery.status === 'completed' ? [22, 163, 74] :
                      delivery.status === 'flagged' ? [220, 38, 38] : [59, 130, 246];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.roundedRect(margin, y, 60, 7, 2, 2, 'F');
  doc.text(`Status: ${DELIVERY_STATUS_LABELS[delivery.status]}`, margin + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Delivery info table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Lieferungsdetails', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [],
    body: [
      ['Lieferant', delivery.supplier_name, 'Spediteur', delivery.carrier || '—'],
      ['Lieferscheinnummer', delivery.delivery_note_number || '—', 'Bestellnummer', delivery.purchase_order_number || '—'],
      ['Anzahl Pakete', String(delivery.number_of_packages), 'Zuständig', delivery.assigned_to || '—'],
      ['Erw. Lieferdatum', delivery.expected_date ? format(parseISO(delivery.expected_date), 'dd.MM.yyyy') : '—',
       'Tatsächlicher Eingang', delivery.actual_arrival_date ? format(parseISO(delivery.actual_arrival_date), 'dd.MM.yyyy HH:mm') : '—'],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, fillColor: [249, 250, 251] },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 45, fillColor: [249, 250, 251] },
      3: { cellWidth: 55 },
    },
    theme: 'grid',
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Packages
  if (delivery.packages && delivery.packages.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Paketprüfung', margin, y);
    y += 4;

    for (const pkg of delivery.packages) {
      const checklist = pkg.checklist_json || {};
      const checklistRows = CHECKLIST_ITEMS.map(item => [
        item.label,
        checklist[item.key] ? '✓ Ja' : '✗ Nein',
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [[
          { content: `Paket ${pkg.package_number} — ${pkg.status === 'ok' ? 'In Ordnung' : pkg.status === 'damaged' ? 'BESCHÄDIGT' : 'Ausstehend'}`, colSpan: 2 }
        ]],
        body: [
          ...checklistRows,
          ['Seriennummern', pkg.serial_numbers.join(', ') || '—'],
          ['Geprüft von', pkg.inspected_by || '—'],
          ['Geprüft am', pkg.inspected_at ? format(parseISO(pkg.inspected_at), 'dd.MM.yyyy HH:mm') : '—'],
          ['Notizen', pkg.notes || '—'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: {
          fillColor: pkg.status === 'ok' ? [22, 163, 74] : pkg.status === 'damaged' ? [220, 38, 38] : [107, 114, 128],
          textColor: 255, fontSize: 9, fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 120, fillColor: [249, 250, 251], fontStyle: 'bold' },
          1: { cellWidth: 55 },
        },
        theme: 'grid',
      });

      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

      if (y > 250) { doc.addPage(); y = 20; }
    }
  }

  // Inventory
  if (delivery.inventory && delivery.inventory.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Eingebuchte Artikel', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Beschreibung', 'Art.-Nr.', 'Seriennummer', 'Menge', 'Lagerort', 'Projekt']],
      body: delivery.inventory.map(item => [
        item.description, item.article_number || '—', item.serial_number || '—',
        String(item.quantity), item.location || '—', item.project || '—'
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 64, 175] },
      theme: 'striped',
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Signature
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y + 15, margin + 70, y + 15);
  doc.line(margin + 90, y + 15, margin + 160, y + 15);
  doc.text('Unterschrift Prüfer', margin, y + 20);
  doc.text('Datum / Stempel', margin + 90, y + 20);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`IT Service GmbH — Wareneingangsbeleg WE-${delivery.id.slice(0, 8).toUpperCase()} — Seite ${i}/${totalPages}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  doc.save(`Wareneingang_${delivery.supplier_name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}
