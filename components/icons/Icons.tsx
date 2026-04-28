import Svg, {
  Path, Line, Polyline, Rect, Circle, Polygon,
} from 'react-native-svg';

type P = { s?: number; c?: string; w?: number };

const d = '#1c1917';

export const Settings = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

export const ChevronLeft = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="15 18 9 12 15 6" />
  </Svg>
);

export const ChevronRight = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const ChevronDown = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const ChevronUp = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="18 15 12 9 6 15" />
  </Svg>
);

export const Calendar = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

export const Home = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Polyline points="9 22 9 12 15 12 15 22" />
  </Svg>
);

export const Book = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </Svg>
);

export const Heart = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
);

export const Plus = ({ s = 18, c = d, w = 2.2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const Minus = ({ s = 18, c = d, w = 2.2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const ArrowUpRight = ({ s = 18, c = d, w = 2.2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="7" y1="17" x2="17" y2="7" />
    <Polyline points="7 7 17 7 17 17" />
  </Svg>
);

export const ArrowLeft = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="19" y1="12" x2="5" y2="12" />
    <Polyline points="12 19 5 12 12 5" />
  </Svg>
);

export const Sun = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="4" />
    <Line x1="12" y1="2" x2="12" y2="4" />
    <Line x1="12" y1="20" x2="12" y2="22" />
    <Line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
    <Line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <Line x1="2" y1="12" x2="4" y2="12" />
    <Line x1="20" y1="12" x2="22" y2="12" />
    <Line x1="6.34" y1="17.66" x2="4.93" y2="19.07" />
    <Line x1="19.07" y1="4.93" x2="17.66" y2="6.34" />
  </Svg>
);

export const Moon = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Svg>
);

export const Utensils = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <Path d="M7 2v20" />
    <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
  </Svg>
);

export const Sparkles = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </Svg>
);

export const Play = ({ s = 18, c = d }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
    <Polygon points="6 3 20 12 6 21 6 3" />
  </Svg>
);

export const Pause = ({ s = 18, c = d }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
    <Rect x="6" y="4" width="4" height="16" rx="1" />
    <Rect x="14" y="4" width="4" height="16" rx="1" />
  </Svg>
);

export const CircleIcon = ({ s = 24, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w}>
    <Circle cx="12" cy="12" r="10" />
  </Svg>
);

export const Skip = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="5 4 15 12 5 20 5 4" />
    <Line x1="19" y1="5" x2="19" y2="19" />
  </Svg>
);

export const Clock = ({ s = 12, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

export const Bell = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.27 21a2 2 0 0 0 3.46 0" />
    <Path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8a6 6 0 0 0-12 0c0 4.5-1.41 5.96-2.74 7.33" />
  </Svg>
);

export const BellRing = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.27 21a2 2 0 0 0 3.46 0" />
    <Path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8a6 6 0 0 0-12 0c0 4.5-1.41 5.96-2.74 7.33" />
    <Path d="M4 2.5C2.8 3.7 2 5.3 2 7" />
    <Path d="M22 7c0-1.7-.8-3.3-2-4.5" />
  </Svg>
);

export const BellOff = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.27 21a2 2 0 0 0 3.46 0" />
    <Path d="M17 17H4a1 1 0 0 1-.74-1.67C4.59 13.96 6 12.5 6 8c0-.62.09-1.2.26-1.74" />
    <Path d="M8.56 4.56A6 6 0 0 1 18 8c0 1.8.23 3.14.62 4.17" />
    <Line x1="2" y1="2" x2="22" y2="22" />
  </Svg>
);

export const Search = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Svg>
);

export const RotateCcw = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12a9 9 0 1 0 3-6.7" />
    <Polyline points="3 4 3 10 9 10" />
  </Svg>
);

export const BarChart3 = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 3v18h18" />
    <Rect x="7" y="12" width="3" height="5" rx="1" />
    <Rect x="12" y="8" width="3" height="9" rx="1" />
    <Rect x="17" y="5" width="3" height="12" rx="1" />
  </Svg>
);

export const Feather = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
    <Line x1="16" y1="8" x2="2" y2="22" />
    <Line x1="17.5" y1="15" x2="9" y2="15" />
  </Svg>
);

export const Pencil = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 20h9" />
    <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </Svg>
);

export const FileEdit = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
  </Svg>
);

export const Notebook = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 6h4" />
    <Path d="M2 10h4" />
    <Path d="M2 14h4" />
    <Path d="M2 18h4" />
    <Rect x="4" y="2" width="16" height="20" rx="2" />
  </Svg>
);

export const CalendarCheck = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
    <Polyline points="9 16 11 18 15 14" />
  </Svg>
);

export const Star = ({ s = 90, c = d, w = 1.4, fill = 'none' }: P & { fill?: string }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Svg>
);

export const Trophy = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 21h8" />
    <Path d="M12 17v4" />
    <Path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
    <Path d="M17 5h3v2a4 4 0 0 1-4 4h-1" />
    <Path d="M7 5H4v2a4 4 0 0 0 4 4h1" />
  </Svg>
);

export const OpenBook = ({ s = 90, c = d, w = 1.4 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Svg>
);

export const Cross = ({ s = 90, c = d, w = 1.4 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round">
    <Line x1="12" y1="3" x2="12" y2="21" />
    <Line x1="7" y1="9" x2="17" y2="9" />
  </Svg>
);

export const HourGlass = ({ s = 90, c = d, w = 1.4 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 22h14" />
    <Path d="M5 2h14" />
    <Path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
    <Path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
  </Svg>
);

export const CheckSmall = ({ s = 20, c = d, w = 2.5 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const X = ({ s = 20, c = d, w = 2.5 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);

export const Trash2 = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <Path d="M10 11v6" />
    <Path d="M14 11v6" />
    <Path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </Svg>
);

export const PartyPopper = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5.8 11.3 2 22l10.7-3.8" />
    <Path d="M4 19.5 14.5 9" />
    <Path d="M10.5 13.5 8 16" />
    <Path d="M13 2v3" />
    <Path d="M20 8h3" />
    <Path d="M17.5 3.5l2 2" />
    <Path d="M18 12l2.5 2.5" />
    <Path d="M8.5 6.5L6 4" />
    <Path d="M15.5 8.5c1.4-1.4 3.2-1.8 4-1" />
  </Svg>
);

export const Activity = ({ s = 18, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </Svg>
);

export const Dumbbell = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m6.5 6.5 11 11" />
    <Path d="m21 14-7 7" />
    <Path d="m3 10 7-7" />
    <Path d="m18 11 3 3" />
    <Path d="m3 10 3 3" />
  </Svg>
);

export const Droplets = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 16.3A4.5 4.5 0 0 1 2.5 11.8C2.5 8.8 7 3 7 3s4.5 5.8 4.5 8.8A4.5 4.5 0 0 1 7 16.3z" />
    <Path d="M17.5 21A4 4 0 0 1 13.5 17c0-2.6 4-7.8 4-7.8s4 5.2 4 7.8a4 4 0 0 1-4 4z" />
  </Svg>
);

export const Apple = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 6c1.4-2 3.2-2.7 5-2" />
    <Path d="M12 6c-1.5-2-3-2.3-4.5-2" />
    <Path d="M12 6c0-1.6.4-2.8 1.3-4" />
    <Path d="M6.3 8.2c-2.2 1.5-2 5.3-.6 8.2C7 19 8.4 21 10.3 21c.9 0 1.2-.5 1.9-.5.8 0 1 .5 1.9.5 1.9 0 3.4-2 4.6-4.6 1.5-3.1 1.5-6.8-.8-8.2-1.7-1-3.2-.2-4.1.1-.8.3-1.1.3-1.8 0-.8-.3-2.4-1.1-4.1-.1z" />
  </Svg>
);

export const Coffee = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <Path d="M3 8h14v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" />
    <Line x1="6" y1="2" x2="6" y2="4" />
    <Line x1="10" y1="2" x2="10" y2="4" />
    <Line x1="14" y1="2" x2="14" y2="4" />
  </Svg>
);

export const Pill = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10 21a6 6 0 0 1-4.24-10.24l5-5a6 6 0 0 1 8.48 8.48l-5 5A5.98 5.98 0 0 1 10 21z" />
    <Line x1="8.5" y1="13.5" x2="14.5" y2="19.5" />
  </Svg>
);

export const Brain = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 6.5A3.5 3.5 0 0 1 14.2 4" />
    <Path d="M16 7a3.5 3.5 0 0 1 2 6.4" />
    <Path d="M7.5 10A3.7 3.7 0 0 0 6 17a3.5 3.5 0 0 0 6 2.5" />
    <Path d="M12 4v16" />
    <Path d="M12 8.5c1.2-.8 2.7-.6 3.5.5" />
    <Path d="M12 15c1.1.9 2.8.9 4-.1" />
  </Svg>
);

export const Eye = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

export const Leaf = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 21c9-1 14-7 15-18C11 4 4 9 3 18c-.2 1.6.5 3 2 3z" />
    <Path d="M8 16c2.5-2.7 5.5-4.7 9-6" />
  </Svg>
);

export const Music = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18V5l12-2v13" />
    <Circle cx="6" cy="18" r="3" />
    <Circle cx="18" cy="16" r="3" />
  </Svg>
);

export const Wind = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 8h11a3 3 0 1 0-3-3" />
    <Path d="M3 12h16a3 3 0 1 1-3 3" />
    <Path d="M3 16h7" />
  </Svg>
);

export const Waves = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 8c2 0 2-1.5 4-1.5S8 8 10 8s2-1.5 4-1.5S16 8 18 8s2-1.5 4-1.5" />
    <Path d="M2 14c2 0 2-1.5 4-1.5S8 14 10 14s2-1.5 4-1.5S16 14 18 14s2-1.5 4-1.5" />
    <Path d="M2 20c2 0 2-1.5 4-1.5S8 20 10 20s2-1.5 4-1.5S16 20 18 20s2-1.5 4-1.5" />
  </Svg>
);

export const Briefcase = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="7" width="18" height="13" rx="2" />
    <Path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <Line x1="3" y1="12" x2="21" y2="12" />
  </Svg>
);

export const Flame = ({ s = 11, filled = false, color = '#f97316' }: { s?: number; filled?: boolean; color?: string }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? color : '#e8e5da'}>
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
  </Svg>
);

export const Grid3x3 = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" />
    <Line x1="9" y1="3" x2="9" y2="21" />
    <Line x1="15" y1="3" x2="15" y2="21" />
    <Line x1="3" y1="9" x2="21" y2="9" />
    <Line x1="3" y1="15" x2="21" y2="15" />
  </Svg>
);

export const BookMarked = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <Polyline points="10 2 10 8 13 6 16 8 16 2" />
  </Svg>
);

export const Target = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Circle cx="12" cy="12" r="6" />
    <Circle cx="12" cy="12" r="2" />
  </Svg>
);

export const CalendarHeart = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 10H3" />
    <Path d="M16 2v4" />
    <Path d="M8 2v4" />
    <Rect x="3" y="4" width="18" height="18" rx="2" />
    <Path d="M12 17c-1.5-1.5-3-2.5-3-4a2 2 0 0 1 3-1.7A2 2 0 0 1 15 13c0 1.5-1.5 2.5-3 4z" />
  </Svg>
);

export const ListChecks = ({ s = 22, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="10" y1="6" x2="21" y2="6" />
    <Line x1="10" y1="12" x2="21" y2="12" />
    <Line x1="10" y1="18" x2="21" y2="18" />
    <Polyline points="3 6 4 7 6 5" />
    <Polyline points="3 12 4 13 6 11" />
    <Polyline points="3 18 4 19 6 17" />
  </Svg>
);

export const Candle = ({ s = 20, c = d, w = 1.8 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 4c0-1.5 1.5-3 1.5-3S15 2.5 15 4s-1.34 2-1.5 2C13.34 6 12 5.5 12 4z" fill={c} />
    <Rect x="10" y="6" width="4" height="14" rx="1" />
    <Path d="M6 20h12" />
  </Svg>
);

export const SlidersHorizontal = ({ s = 20, c = d, w = 2 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="21" y1="4" x2="14" y2="4" />
    <Line x1="10" y1="4" x2="3" y2="4" />
    <Line x1="21" y1="12" x2="12" y2="12" />
    <Line x1="8" y1="12" x2="3" y2="12" />
    <Line x1="21" y1="20" x2="16" y2="20" />
    <Line x1="12" y1="20" x2="3" y2="20" />
    <Line x1="14" y1="2" x2="14" y2="6" />
    <Line x1="8" y1="10" x2="8" y2="14" />
    <Line x1="16" y1="18" x2="16" y2="22" />
  </Svg>
);

export const Hourglass = ({ s = 24, c = d, w = 1.5 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    {/* Top half — sand mostly gone (light fill) */}
    <Path
      d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2z"
      fill={c}
      fillOpacity={0.22}
      stroke={c}
      strokeWidth={w}
      strokeLinejoin="round"
    />
    {/* Bottom half — sand collected (solid fill) */}
    <Path
      d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22z"
      fill={c}
      fillOpacity={0.8}
      stroke={c}
      strokeWidth={w}
      strokeLinejoin="round"
    />
    {/* Top bar */}
    <Line x1="5" y1="2" x2="19" y2="2" stroke={c} strokeWidth={w} strokeLinecap="round" />
    {/* Bottom bar */}
    <Line x1="5" y1="22" x2="19" y2="22" stroke={c} strokeWidth={w} strokeLinecap="round" />
  </Svg>
);
