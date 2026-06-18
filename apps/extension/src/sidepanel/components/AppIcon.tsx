import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleCheck,
  CircleDot,
  Command,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  FileUp,
  Flame,
  Focus,
  Folder,
  FolderPlus,
  Globe2,
  GripVertical,
  History,
  Info,
  KeyRound,
  Keyboard,
  LayoutTemplate,
  Link2,
  List,
  ListChecks,
  Lock,
  LockOpen,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Network,
  Palette,
  PencilLine,
  Pin,
  Plus,
  Printer,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';

export type AppIconName =
  | 'calendar'
  | 'camera'
  | 'chat'
  | 'check'
  | 'checkCircle'
  | 'chevronDown'
  | 'chevronRight'
  | 'chevronUp'
  | 'command'
  | 'close'
  | 'download'
  | 'doc'
  | 'domain'
  | 'external'
  | 'fileDown'
  | 'fileUp'
  | 'flame'
  | 'focus'
  | 'folder'
  | 'folderPlus'
  | 'global'
  | 'graph'
  | 'grip'
  | 'history'
  | 'info'
  | 'key'
  | 'list'
  | 'checklist'
  | 'lock'
  | 'markdown'
  | 'more'
  | 'note'
  | 'palette'
  | 'pin'
  | 'plus'
  | 'print'
  | 'search'
  | 'settings'
  | 'shield'
  | 'send'
  | 'spark'
  | 'template'
  | 'trash'
  | 'typewriter'
  | 'unlock'
  | 'upload'
  | 'url'
  | 'workspace'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'arrowUp'
  | 'arrowUpRight'
  | 'light'
  | 'dark';

const ICON_MAP: Record<AppIconName, LucideIcon> = {
  calendar: CalendarDays,
  camera: Camera,
  chat: MessageCircle,
  check: Check,
  checkCircle: CircleCheck,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  command: Command,
  close: X,
  download: Download,
  doc: FileText,
  domain: Globe2,
  external: ExternalLink,
  fileDown: FileDown,
  fileUp: FileUp,
  flame: Flame,
  focus: Focus,
  folder: Folder,
  folderPlus: FolderPlus,
  global: CircleDot,
  graph: Network,
  grip: GripVertical,
  history: History,
  info: Info,
  key: KeyRound,
  list: List,
  checklist: ListChecks,
  lock: Lock,
  markdown: FileText,
  more: MoreHorizontal,
  note: PencilLine,
  palette: Palette,
  pin: Pin,
  plus: Plus,
  print: Printer,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  send: SendHorizontal,
  spark: Sparkles,
  template: LayoutTemplate,
  trash: Trash2,
  typewriter: Keyboard,
  unlock: LockOpen,
  upload: Upload,
  url: Link2,
  workspace: Circle,
  alignLeft: AlignLeft,
  alignCenter: AlignCenter,
  alignRight: AlignRight,
  arrowUp: ArrowUp,
  arrowUpRight: ArrowUpRight,
  light: Sun,
  dark: Moon,
};

export function AppIcon({
  name,
  size = 15,
  strokeWidth = 2.25,
  className,
  style,
}: {
  name: AppIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = ICON_MAP[name];
  return (
    <Icon
      aria-hidden="true"
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
}

export default AppIcon;
