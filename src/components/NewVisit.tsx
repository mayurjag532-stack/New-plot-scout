import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PropertyRecord, CapturedLocation, MapIntel, PriceData, PropertyPhoto, PropertyStatus } from "../types";
import { saveProperty } from "../db";
import PropertyHeader from "./PropertyHeader";
import SpatialHero from "./SpatialHero";
import DossierSummary from "./dossier/DossierSummary";
import DossierSection, { SectionTone } from "./dossier/DossierSection";
import LocationCapture from "./LocationCapture";
import PropertyIdentityPanel from "./PropertyIdentity";
import ParcelIntelligencePanel from "./ParcelIntelligence";
import MapIntelligence from "./MapIntelligence";
import SmartInspection from "./SmartInspection";
import PriceDataPanel from "./PriceData";
import PhotoEvidence from "./PhotoEvidence";
import NotesPanel from "./Notes";
import FinalStatusPanel from "./FinalStatus";
import { visitSectionStates, sectionStateLabel, VisitSectionId, VisitSectionState } from "../utils/visitState";
import { canUse, Plan, PLAN_META } from "../entitlements";
import { BuyerProfile } from "../personalization";
import BuyerFitPanel from "./BuyerFitPanel";
import { prefersReducedMotion } from "../hooks";

const TONE: Record<VisitSectionState, SectionTone> = {
  READY: "ready", IN_PROGRESS: "in-progress", NEEDS_ATTENTION: "needs-attention", NOT_STARTED: "not-started"
};

/* Dossier order: where it is → who/what it is → what it costs → what the ground says → proof → decision */
const ORDER: { id: VisitSectionId; title: string; short: string }[] = [
  { id: "location", title: "Position & surroundings", short: "Position" },
  { id: "identity", title: "Records & identity", short: "Records" },
  { id: "economics", title: "Deal economics", short: "Economics" },
  { id: "ground", title: "Field inspection", short: "Inspection" },
  { id: "evidence", title: "Evidence vault", short: "Evidence" },
  { id: "decision", title: "Decision room", short: "Decision" }
];

export default function NewVisit({
  initial,
  onBack,
  plan,
  buyerProfile
}: {
  initial: PropertyRecord;
  onBack: () => void;
  plan: Plan;
  buyerProfile: BuyerProfile;
}) {
  const [property, setProperty] = useState<PropertyRecord>(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [explore, setExplore] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<VisitSectionId>("location");
  const heroRef = useRef<HTMLDivElement>(null);

  // Autosave on every change, debounced, so nothing is lost if the browser closes.
  useEffect(() => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveProperty(property);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property]);

  async function leaveVisit() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      setSaveState("saving");
      await saveProperty(property);
      setSaveState("saved");
      onBack();
    } catch {
      setSaveState("error");
      if (confirm("The latest changes could not be saved. Leave this visit anyway?")) onBack();
    }
  }

  function update(patch: Partial<PropertyRecord>) {
    setProperty((p) => ({ ...p, ...patch }));
  }

  const sections = visitSectionStates(property);
  const byId = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s])) as Record<VisitSectionId, (typeof sections)[number]>, [sections]);

  /* Progressive disclosure: sections that still need work start open; finished
     ones fold away. Decided once on mount so typing never collapses a section. */
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initialStates = visitSectionStates(initial);
    const o: Record<string, boolean> = {};
    let nextUp = false;
    for (const { id } of ORDER) {
      const s = initialStates.find((x) => x.id === id)!;
      if (s.state === "IN_PROGRESS" || s.state === "NEEDS_ATTENTION") o[id] = true;
      else if (s.state === "NOT_STARTED" && !nextUp) { o[id] = true; nextUp = true; }
      else o[id] = false;
    }
    return o;
  });

  const prevSectionStates = useRef<Record<string, string>>({});
  const [justReady, setJustReady] = useState<Set<string>>(new Set());
  useEffect(() => {
    const becameReady = sections.filter((s) => s.state === "READY" && prevSectionStates.current[s.id] && prevSectionStates.current[s.id] !== "READY").map((s) => s.id);
    prevSectionStates.current = Object.fromEntries(sections.map((s) => [s.id, s.state]));
    if (becameReady.length === 0) return;
    setJustReady((prev) => new Set([...prev, ...becameReady]));
    const t = window.setTimeout(() => {
      setJustReady((prev) => { const next = new Set(prev); becameReady.forEach((id) => next.delete(id)); return next; });
    }, 700);
    return () => window.clearTimeout(t);
  }, [sections]);

  /* Header condenses once the aerial hero has scrolled away. */
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCondensed(!entry.isIntersecting), { threshold: 0, rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  /* Scroll-spy for the section navigator. */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = ORDER.map(({ id }) => document.getElementById(id)).filter((x): x is HTMLElement => Boolean(x));
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id as VisitSectionId);
    }, { rootMargin: "-120px 0px -62% 0px", threshold: 0 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const jump = useCallback((id: string) => {
    setOpen((o) => ({ ...o, [id]: true }));
    setActive(id as VisitSectionId);
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }, 40);
  }, []);

  const locationSection = (
    <>
      <LocationCapture location={property.location} onCaptured={(location: CapturedLocation) => update({ location })} />
      {property.location && (canUse(plan, "map_intelligence")
        ? <MapIntelligence location={property.location} intel={property.mapIntel} onIntelUpdated={(mapIntel: MapIntel) => update({ mapIntel })} />
        : (
          <div className="ps-locked">
            <div>
              <p className="font-display">Map intelligence</p>
              <small>Nearby roads, access and mapped activity around the pin.</small>
            </div>
            <span className="tier-lock">{PLAN_META.ADVANCED.name}</span>
          </div>
        ))}
    </>
  );

  const content: Record<VisitSectionId, React.ReactNode> = {
    location: locationSection,
    identity: (
      <>
        <PropertyIdentityPanel identity={property.identity} onChange={(identity) => update({ identity })} />
        <ParcelIntelligencePanel identity={property.identity} fieldLocation={property.location} value={property.parcelIntel} onChange={(parcelIntel) => update({ parcelIntel })} />
      </>
    ),
    economics: <PriceDataPanel price={property.price} onChange={(price: PriceData) => update({ price })} />,
    ground: <SmartInspection property={property} onAnswer={(id, value) => update({ ownerAnswers: { ...property.ownerAnswers, [id]: value } })} onNotesChange={(site) => update({ notes: { ...property.notes, site } })} />,
    evidence: (
      <>
        <PhotoEvidence photos={property.photos} onAdd={(photo: PropertyPhoto) => update({ photos: [...property.photos, photo] })} onRemove={(id) => update({ photos: property.photos.filter((p) => p.id !== id) })} onUpdate={(id, patch) => update({ photos: property.photos.map((p) => p.id === id ? { ...p, ...patch } : p) })} />
        <NotesPanel owner={property.notes.owner} general={property.notes.general} onOwnerChange={(owner) => update({ notes: { ...property.notes, owner } })} onGeneralChange={(general) => update({ notes: { ...property.notes, general } })} />
      </>
    ),
    decision: (
      <>
        <BuyerFitPanel property={property} profile={buyerProfile} />
        <FinalStatusPanel property={property} onStatusChange={(finalStatus: PropertyStatus) => update({ finalStatus })} onFollowUpChange={(followUp) => update({ followUp })} />
      </>
    )
  };

  return (
    <div className={`ps-dpage ${explore ? "is-explore" : ""}`}>
      <PropertyHeader property={property} condensed={condensed} scrolled={scrolled} onBack={leaveVisit} />
      <div className="ps-dgrid">
        <div className="ps-dspatial" ref={heroRef}>
          <SpatialHero property={property} explore={explore} onExploreChange={setExplore} />
        </div>

        <div className="ps-dsheet">
          <div className="ps-dsheet-grab" aria-hidden="true" />
          <DossierSummary property={property} saveState={saveState} onNameChange={(name) => update({ name })} onJump={jump} />

          <nav className="ps-dnav" aria-label="Dossier sections">
            <div className="ps-dnav-track">
              {ORDER.map(({ id, short }, i) => {
                const s = byId[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => jump(id)}
                    aria-current={active === id ? "true" : undefined}
                    className={`ps-dnav-item ${justReady.has(id) ? "ps-just-ready" : ""}`}
                    title={sectionStateLabel[s.state]}
                  >
                    <i className={`ps-dot ps-state-${s.state.toLowerCase().replace("_", "-")}`} aria-hidden="true" />
                    {short}
                    <span className="sr-only"> — {sectionStateLabel[s.state]}</span>
                    <span className="ps-dnav-n" aria-hidden="true">{i + 1}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <main className="ps-dsections">
            {ORDER.map(({ id, title }, i) => {
              const s = byId[id];
              return (
                <DossierSection
                  key={id}
                  id={id}
                  index={i + 1}
                  title={title}
                  tone={TONE[s.state]}
                  stateLabel={sectionStateLabel[s.state]}
                  summary={`${s.done} of ${s.total} complete`}
                  open={open[id]}
                  onToggle={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
                  delay={i * 40}
                >
                  {content[id]}
                </DossierSection>
              );
            })}
          </main>
        </div>
      </div>
    </div>
  );
}
