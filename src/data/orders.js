export const ORDERS = [
  { id: 1,  network: 'MTN',        bundle: '10GB',  phone: '0551234567', price: 39.80, status: 'Delivered', time: '9:30 AM',  date: 'Today'     },
  { id: 2,  network: 'AirtelTigo', bundle: '5GB',   phone: '0271234567', price: 21.80, status: 'Delivered', time: '2:45 PM',  date: 'Today'     },
  { id: 3,  network: 'Telecel',    bundle: '2GB',   phone: '0201234567', price:  8.40, status: 'Pending',   time: '4:10 PM',  date: 'Today'     },
  { id: 4,  network: 'MTN',        bundle: '1GB',   phone: '0551234567', price:  4.00, status: 'Delivered', time: '1:55 PM',  date: 'Yesterday' },
  { id: 5,  network: 'Telecel',    bundle: '6GB',   phone: '0201234567', price: 25.20, status: 'Delivered', time: '9:12 AM',  date: 'Yesterday' },
  { id: 6,  network: 'AirtelTigo', bundle: '3GB',   phone: '0271234567', price: 12.60, status: 'Delivered', time: '6:38 PM',  date: 'Yesterday' },
  { id: 7,  network: 'MTN',        bundle: '25GB',  phone: '0551234567', price: 96.50, status: 'Delivered', time: '3:00 PM',  date: '2 days ago' },
  { id: 8,  network: 'Telecel',    bundle: '4GB',   phone: '0201234567', price: 16.80, status: 'Delivered', time: '11:20 AM', date: '2 days ago' },
]

export function groupByDate(orders) {
  const groups = []
  const seen = {}
  for (const order of orders) {
    if (!seen[order.date]) {
      seen[order.date] = []
      groups.push({ date: order.date, items: seen[order.date] })
    }
    seen[order.date].push(order)
  }
  return groups
}
