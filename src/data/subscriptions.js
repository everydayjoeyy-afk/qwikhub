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
  { value: 'spotify-1m',    label: 'Spotify Premium | 1 month',               price: 29.13,  logo: spotify     },
  { value: 'spotify-2m',    label: 'Spotify Premium | 2 months',              price: 51.23,  logo: spotify     },
  { value: 'spotify-3m',    label: 'Spotify Premium | 3 months',              price: 68.52,  logo: spotify     },
  { value: 'capcut-1m',     label: 'CapCut Pro (Monthly – Private)',           price: 48.02,  logo: capcut      },
  { value: 'amazon-3m',     label: 'Amazon Prime Video | 3 months',           price: 152.08, logo: amazonPrime },
  { value: 'amazon-6m',     label: 'Amazon Prime Video | 6 months',           price: 224.11, logo: amazonPrime },
  { value: 'apple-2m',      label: 'Apple Music Subscription | 2 months',     price: 99.25,  logo: appleMusic  },
  { value: 'netflix-1m',    label: 'Netflix 4K Ultra HD | Shared – 1 month',  price: 52.02,  logo: netflix     },
  { value: 'netflix-3m',    label: 'Netflix 4K Ultra HD | Shared – 3 months', price: 134.00, logo: netflix     },
  { value: 'netflix-6m',    label: 'Netflix 4K Ultra HD | Shared – 6 months', price: 250.05, logo: netflix     },
  { value: 'netflix-12m',   label: 'Netflix 4K Ultra HD | Shared – 12 months',price: 482.33, logo: netflix     },
  { value: 'youtube-1m',    label: 'YouTube Premium | 1 month',               price: 48.02,  logo: youtube     },
  { value: 'adobe-3m',      label: 'Adobe Photoshop Premium | 3 months',      price: 20.01,  logo: photoshop   },
  { value: 'kinemaster-3m', label: 'Kinemaster Premium | 3 months',           price: 20.01,  logo: kinemaster  },
  { value: 'adguard-3m',    label: 'AdGuard Premium | 3 months',              price: 18.00,  logo: adguard     },
  { value: 'grammarly-3m',  label: 'Grammarly Premium | 3 months',            price: 24.01,  logo: grammarly   },
]
