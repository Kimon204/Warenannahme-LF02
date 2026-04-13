import { DeliveryStatus, PackageStatus, DiscrepancyStatus,
  DELIVERY_STATUS_LABELS, PACKAGE_STATUS_LABELS, DISCREPANCY_STATUS_LABELS } from '../../types';

const deliveryColors: Record<DeliveryStatus, string> = {
  expected:      'bg-blue-100 text-blue-800',
  arrived:       'bg-indigo-100 text-indigo-800',
  in_inspection: 'bg-yellow-100 text-yellow-800',
  completed:     'bg-green-100 text-green-800',
  flagged:       'bg-red-100 text-red-800',
  returned:      'bg-gray-100 text-gray-700',
};

const packageColors: Record<PackageStatus, string> = {
  pending:     'bg-gray-100 text-gray-700',
  inspecting:  'bg-yellow-100 text-yellow-800',
  ok:          'bg-green-100 text-green-800',
  damaged:     'bg-red-100 text-red-800',
  discrepancy: 'bg-orange-100 text-orange-800',
};

const discrepancyColors: Record<DiscrepancyStatus, string> = {
  open:           'bg-red-100 text-red-800',
  in_progress:    'bg-yellow-100 text-yellow-800',
  resolved:       'bg-green-100 text-green-800',
  complaint_sent: 'bg-purple-100 text-purple-800',
};

interface Props {
  type: 'delivery' | 'package' | 'discrepancy';
  status: string;
}

export default function StatusBadge({ type, status }: Props) {
  let color = 'bg-gray-100 text-gray-700';
  let label = status;

  if (type === 'delivery') {
    color = deliveryColors[status as DeliveryStatus] ?? color;
    label = DELIVERY_STATUS_LABELS[status as DeliveryStatus] ?? status;
  } else if (type === 'package') {
    color = packageColors[status as PackageStatus] ?? color;
    label = PACKAGE_STATUS_LABELS[status as PackageStatus] ?? status;
  } else if (type === 'discrepancy') {
    color = discrepancyColors[status as DiscrepancyStatus] ?? color;
    label = DISCREPANCY_STATUS_LABELS[status as DiscrepancyStatus] ?? status;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
