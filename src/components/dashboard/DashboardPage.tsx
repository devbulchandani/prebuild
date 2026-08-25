import { useUI } from "../../store/ui";
import { useScene } from "../../store/scene";
import { IconPlus, PrebuildMark, IconChevron } from "../icons";

interface Project {
  name: string;
  location: string;
  edited: string;
  status: "In Progress" | "Shared" | "Concept" | "Approved";
  thumb: React.ReactNode;
}

function Thumb({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-[#f2f1ed]">
      <svg viewBox="0 0 320 200" className="h-full w-full">
        {children}
      </svg>
    </div>
  );
}

const S = { stroke: "#8b8e94", strokeWidth: 1.2, fill: "none" } as const;
const SA = { stroke: "#d9a441", strokeWidth: 1.4, fill: "none" } as const;

const THUMBS = {
  villa: (
    <>
      <path d="M40 150h240" {...S} />
      <rect x="70" y="80" width="120" height="70" {...S} />
      <rect x="190" y="55" width="70" height="95" {...SA} />
      <path d="M70 80l60-30 60 30M190 55l35-18 35 18" {...S} />
      <rect x="90" y="100" width="24" height="50" {...S} />
      <rect x="130" y="100" width="24" height="26" {...S} />
      <rect x="205" y="75" width="16" height="22" {...S} />
      <rect x="232" y="75" width="16" height="22" {...S} />
      <circle cx="270" cy="42" r="12" {...S} />
    </>
  ),
  apartment: (
    <>
      <path d="M40 160h240" {...S} />
      <rect x="110" y="45" width="100" height="115" {...SA} />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={122 + c * 28} y={58 + r * 25} width={16} height={14} {...S} />
        )),
      )}
      <path d="M85 160V90l25-14M235 160V95l-25-12" {...S} />
    </>
  ),
  office: (
    <>
      <path d="M40 155h240" {...S} />
      <path d="M60 155v-60l60-20v80M120 155V75l140 0v80M260 155V95l-40-15" {...SA} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M135 ${92 + i * 22}h112`} {...S} />
      ))}
      <circle cx="90" cy="105" r="10" {...S} />
    </>
  ),
  residence: (
    <>
      <path d="M40 150h240" {...S} />
      <path d="M80 150v-52l52-34 52 34v52z" {...SA} />
      <path d="M184 150v-38h56v38M196 128h32M212 112v38" {...S} />
      <rect x="118" y="108" width="28" height="42" {...S} />
      <path d="M132 66v-16h14v26" {...S} />
      <circle cx="62" cy="52" r="10" {...S} />
    </>
  ),
};

const PROJECTS: Project[] = [
  { name: "Villa Jaipur", location: "Jaipur · Rajasthan", edited: "2 min ago", status: "In Progress", thumb: THUMBS.villa },
  { name: "Modern Apartment", location: "Worli · Mumbai", edited: "Yesterday", status: "Shared", thumb: THUMBS.apartment },
  { name: "Office Interior", location: "Indiranagar · Bengaluru", edited: "3 days ago", status: "Concept", thumb: THUMBS.office },
  { name: "Luxury Residence", location: "Lutyens · Delhi", edited: "Last week", status: "Approved", thumb: THUMBS.residence },
];

const STATUS_STYLE: Record<Project["status"], string> = {
  "In Progress": "border-accent/40 text-accent",
  Shared: "border-line-strong text-dim",
  Concept: "border-line-strong text-faint",
  Approved: "border-emerald-500/40 text-emerald-400",
};

export function DashboardPage() {
  const setView = useUI((s) => s.setView);
  const showToast = useUI((s) => s.showToast);

  let newCount = 0;
  const newProject = () => {
    useScene.getState().newProject(`Untitled Project ${++newCount === 1 ? "" : newCount}`.trim());
    setView("editor");
    showToast("Created — click the project name (top-left) to rename it");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-line bg-base px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-accent">
          <PrebuildMark size={19} />
          <span className="text-[13px] font-semibold tracking-[0.22em] text-text">PREBUILD</span>
        </div>
        <button
          onClick={newProject}
          className="flex h-8 items-center gap-1.5 rounded-full bg-text px-4 font-mono text-[11px] uppercase tracking-wider text-base transition-opacity hover:opacity-85"
        >
          <IconPlus size={13} />
          New Project
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-faint">
          See it before you build it.
        </p>
        <h1 className="mt-3 text-[32px] font-medium tracking-tight text-text">
          Your Projects
          <span className="ml-3 align-middle font-mono text-[13px] font-normal tracking-widest text-faint">
            {String(PROJECTS.length).padStart(2, "0")}
          </span>
        </h1>

        <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECTS.map((p) => (
            <button
              key={p.name}
              onClick={() => setView("editor")}
              className="group rounded-md border border-line bg-base text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
            >
              <div className="relative transition-opacity group-hover:opacity-95">
                <Thumb>{p.thumb}</Thumb>
                <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-xs border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-widest text-white/50 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  Open <IconChevron size={9} />
                </span>
              </div>
              <div className="px-3.5 pb-3 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-[14px] font-medium text-text">{p.name}</h3>
                  <span
                    className={`shrink-0 rounded-xs border px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-widest ${STATUS_STYLE[p.status]}`}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-faint">
                  {p.location}
                </p>
                <p className="mt-2.5 font-mono text-[10px] uppercase tracking-wide text-dim">
                  Edited {p.edited}
                </p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
