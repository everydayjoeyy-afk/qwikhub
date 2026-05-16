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

export const SUBSCRIPTION_OPTIONS = [
  { value: 'spotify-1m',    label: 'Spotify Premium | 1 month',               price: 20.81,  logo: spotify     },
  { value: 'spotify-2m',    label: 'Spotify Premium | 2 months',              price: 36.59,  logo: spotify     },
  { value: 'spotify-3m',    label: 'Spotify Premium | 3 months',              price: 48.94,  logo: spotify     },
  { value: 'capcut-1m',     label: 'CapCut Pro (Monthly – Private)',           price: 34.30,  logo: capcut      },
  { value: 'amazon-3m',     label: 'Amazon Prime Video | 3 months',           price: 108.63, logo: amazonPrime },
  { value: 'amazon-6m',     label: 'Amazon Prime Video | 6 months',           price: 160.08, logo: amazonPrime },
  { value: 'apple-2m',      label: 'Apple Music Subscription | 2 months',     price: 70.89,  logo: appleMusic  },
  { value: 'netflix-1m',    label: 'Netflix 4K Ultra HD | Shared – 1 month',  price: 37.16,  logo: netflix     },
  { value: 'netflix-3m',    label: 'Netflix 4K Ultra HD | Shared – 3 months', price: 95.71,  logo: netflix     },
  { value: 'netflix-6m',    label: 'Netflix 4K Ultra HD | Shared – 6 months', price: 178.61, logo: netflix     },
  { value: 'netflix-12m',   label: 'Netflix 4K Ultra HD | Shared – 12 months',price: 344.52, logo: netflix     },
  { value: 'youtube-1m',    label: 'YouTube Premium | 1 month',               price: 34.30,  logo: youtube     },
  { value: 'adobe-3m',      label: 'Adobe Photoshop Premium | 3 months',      price: 14.29,  logo: photoshop   },
  { value: 'kinemaster-3m', label: 'Kinemaster Premium | 3 months',           price: 14.29,  logo: kinemaster  },
  { value: 'adguard-3m',    label: 'AdGuard Premium | 3 months',              price: 12.86,  logo: adguard     },
  { value: 'grammarly-3m',  label: 'Grammarly Premium | 3 months',            price: 17.15,  logo: grammarly   },
]
