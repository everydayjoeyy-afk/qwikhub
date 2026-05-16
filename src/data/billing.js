import spotify      from '../assets/spotify.jpg'
import capcut       from '../assets/capcut.jpg'
import amazonPrime  from '../assets/amazon prime.jpg'
import appleMusic   from '../assets/apple music.jpg'
import netflix      from '../assets/netflix.jpg'
import youtube      from '../assets/youtube.jpg'
import photoshop    from '../assets/photoshop.jpg'
import kinemaster   from '../assets/kinemaster.jpg'
import adguard      from '../assets/adguard.jpg'
import grammarly    from '../assets/grammarly.jpg'

export const BILLING = [
  { id: 1,  service: 'Spotify Premium | 1 month',               email: 'joel@qwikhub.com',  price: 20.81,  status: 'Delivered', time: '9:14 AM',  date: 'Today',      logo: spotify     },
  { id: 2,  service: 'YouTube Premium | 1 month',               email: 'joel@qwikhub.com',  price: 34.30,  status: 'Delivered', time: '11:02 AM', date: 'Today',      logo: youtube     },
  { id: 3,  service: 'Netflix 4K Ultra HD | Shared – 1 month',  email: 'joel@qwikhub.com',  price: 37.16,  status: 'Pending',   time: '3:45 PM',  date: 'Today',      logo: netflix     },
  { id: 4,  service: 'Spotify Premium | 3 months',              email: 'joel@qwikhub.com',  price: 48.94,  status: 'Delivered', time: '8:30 AM',  date: 'Yesterday',  logo: spotify     },
  { id: 5,  service: 'CapCut Pro (Monthly – Private)',          email: 'joel@qwikhub.com',  price: 34.30,  status: 'Delivered', time: '10:17 AM', date: 'Yesterday',  logo: capcut      },
  { id: 6,  service: 'Amazon Prime Video | 3 months',           email: 'joel@qwikhub.com',  price: 108.63, status: 'Delivered', time: '1:55 PM',  date: 'Yesterday',  logo: amazonPrime },
  { id: 7,  service: 'Grammarly Premium | 3 months',            email: 'joel@qwikhub.com',  price: 17.15,  status: 'Delivered', time: '4:20 PM',  date: 'Yesterday',  logo: grammarly   },
  { id: 8,  service: 'Apple Music Subscription | 2 months',     email: 'joel@qwikhub.com',  price: 70.89,  status: 'Delivered', time: '9:00 AM',  date: '2 days ago', logo: appleMusic  },
  { id: 9,  service: 'Adobe Photoshop Premium | 3 months',      email: 'joel@qwikhub.com',  price: 14.29,  status: 'Delivered', time: '11:45 AM', date: '2 days ago', logo: photoshop   },
  { id: 10, service: 'Kinemaster Premium | 3 months',           email: 'joel@qwikhub.com',  price: 14.29,  status: 'Delivered', time: '2:10 PM',  date: '2 days ago', logo: kinemaster  },
  { id: 11, service: 'AdGuard Premium | 3 months',              email: 'joel@qwikhub.com',  price: 12.86,  status: 'Delivered', time: '3:30 PM',  date: '2 days ago', logo: adguard     },
  { id: 12, service: 'Netflix 4K Ultra HD | Shared – 3 months', email: 'joel@qwikhub.com',  price: 95.71,  status: 'Delivered', time: '5:00 PM',  date: '2 days ago', logo: netflix     },
]

export function groupByDate(items) {
  const groups = []
  const seen = {}
  for (const item of items) {
    if (!seen[item.date]) {
      seen[item.date] = []
      groups.push({ date: item.date, items: seen[item.date] })
    }
    seen[item.date].push(item)
  }
  return groups
}
