export const TRANSACTIONS = [
  { id: 1,  name: 'Wallet Top-Up',           time: '9:14 AM',  amount:  20000, date: 'Today'     },
  { id: 2,  name: 'MTN 10GB Bundle',         time: '9:30 AM',  amount:  -3980, date: 'Today'     },
  { id: 3,  name: 'YouTube Premium',         time: '11:02 AM', amount:  -2400, date: 'Today'     },
  { id: 4,  name: 'AirtelTigo 5GB Bundle',   time: '2:45 PM',  amount:  -2180, date: 'Today'     },
  { id: 5,  name: 'Wallet Top-Up',           time: '8:00 AM',  amount:  50000, date: 'Yesterday' },
  { id: 6,  name: 'Telecel 2GB Bundle',      time: '10:17 AM', amount:   -840, date: 'Yesterday' },
  { id: 7,  name: 'Netflix Subscription',    time: '12:03 PM', amount:  -6500, date: 'Yesterday' },
  { id: 8,  name: 'MTN 1GB Bundle',          time: '1:55 PM',  amount:   -400, date: 'Yesterday' },
  { id: 9,  name: 'Instagram Followers',     time: '4:20 PM',  amount:  -1500, date: 'Yesterday' },
  { id: 10, name: 'AirtelTigo 3GB Bundle',   time: '6:38 PM',  amount:  -1260, date: 'Yesterday' },
  { id: 11, name: 'Wallet Top-Up',           time: '7:45 AM',  amount:  10000, date: '2 days ago' },
  { id: 12, name: 'Telecel 6GB Bundle',      time: '9:12 AM',  amount:  -2520, date: '2 days ago' },
  { id: 13, name: 'Spotify Premium',         time: '11:30 AM', amount:  -1800, date: '2 days ago' },
  { id: 14, name: 'MTN 25GB Bundle',         time: '3:00 PM',  amount:  -9650, date: '2 days ago' },
]

export function formatAmount(amount) {
  const abs = Math.abs(amount).toLocaleString()
  return amount >= 0 ? `+₵${abs}` : `-₵${abs}`
}

export function groupByDate(transactions) {
  const groups = []
  const seen = {}
  for (const tx of transactions) {
    if (!seen[tx.date]) {
      seen[tx.date] = []
      groups.push({ date: tx.date, items: seen[tx.date] })
    }
    seen[tx.date].push(tx)
  }
  return groups
}
