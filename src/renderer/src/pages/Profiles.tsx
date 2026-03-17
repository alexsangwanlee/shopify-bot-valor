import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Download,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { BillingProfile, BillingProfileInput, isProfileValidated } from '@core/app-data';

type ProfileDraft = BillingProfileInput & {
  cardNumber: string;
  cvv: string;
  secureCardAction: 'preserve' | 'replace' | 'remove';
};

const emptyDraft: ProfileDraft = {
  name: '',
  email: '',
  address1: '',
  city: '',
  phone: '',
  province: '',
  zip: '',
  country: 'United States',
  captchaApiKey: '',
  cardBrand: '',
  last4: '',
  cardHolder: '',
  expiryMonth: '',
  expiryYear: '',
  cardNumber: '',
  cvv: '',
  secureCardAction: 'replace',
};

function createDraftFromProfile(profile?: BillingProfile): ProfileDraft {
  if (!profile) {
    return emptyDraft;
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    address1: profile.address1,
    city: profile.city,
    phone: profile.phone ?? '',
    province: profile.province ?? '',
    zip: profile.zip ?? '',
    country: profile.country ?? 'United States',
    captchaApiKey: profile.captchaApiKey ?? '',
    cardBrand: profile.cardBrand,
    last4: profile.last4,
    cardHolder: profile.cardHolder ?? '',
    expiryMonth: profile.expiryMonth ?? '',
    expiryYear: profile.expiryYear ?? '',
    hasSecureCard: profile.hasSecureCard,
    validated: profile.validated,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    cardNumber: '',
    cvv: '',
    secureCardAction: profile.hasSecureCard ? 'preserve' : 'replace',
  };
}

export const Profiles: React.FC = () => {
  const [profiles, setProfiles] = useState<BillingProfile[]>([]);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  useEffect(() => {
    const loadProfiles = async () => {
      setProfiles(await window.electronAPI.getProfiles());
    };

    void loadProfiles();
  }, []);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return profiles;
    }

    return profiles.filter((profile) =>
      [
        profile.name,
        profile.email,
        profile.city,
        profile.cardBrand,
        profile.last4,
        profile.country,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [profiles, query]);

  const saveProfiles = async (nextProfiles: BillingProfileInput[]) => {
    const response = await window.electronAPI.saveProfiles(nextProfiles);
    if (!response.success) {
      throw new Error(response.error || 'Failed to persist profiles');
    }

    setProfiles(response.profiles ?? []);
  };

  const openCreateModal = () => {
    setEditingProfileId(null);
    setDraft(emptyDraft);
    setIsModalOpen(true);
  };

  const openEditModal = (profile: BillingProfile) => {
    setEditingProfileId(profile.id);
    setDraft(createDraftFromProfile(profile));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setDraft(emptyDraft);
    setEditingProfileId(null);
    setIsModalOpen(false);
  };

  const handleUpsertProfile = async () => {
    const normalizedCardNumber = draft.cardNumber.replace(/\D/g, '');
    const normalizedLast4 = normalizedCardNumber.slice(-4) || (draft.last4 ?? '').replace(/\D/g, '').slice(-4);
    const secureCard =
      draft.secureCardAction === 'remove'
        ? null
        : normalizedCardNumber && draft.cvv.trim()
          ? {
              cardNumber: normalizedCardNumber,
              cardHolder: draft.cardHolder?.trim() || draft.name.trim(),
              expiryMonth: draft.expiryMonth?.trim() || '',
              expiryYear: draft.expiryYear?.trim() || '',
              cvv: draft.cvv.trim(),
            }
          : undefined;

    const profileInput: BillingProfileInput = {
      id: editingProfileId ?? undefined,
      name: draft.name.trim(),
      email: draft.email.trim(),
      address1: draft.address1.trim(),
      city: draft.city.trim(),
      phone: draft.phone?.trim(),
      province: draft.province?.trim(),
      zip: draft.zip?.trim(),
      country: draft.country?.trim() || 'United States',
      captchaApiKey: draft.captchaApiKey?.trim(),
      cardBrand: draft.cardBrand?.trim() || 'Card',
      cardHolder: draft.cardHolder?.trim() || draft.name.trim(),
      expiryMonth: draft.expiryMonth?.trim(),
      expiryYear: draft.expiryYear?.trim(),
      last4: normalizedLast4,
      secureCard,
      validated: isProfileValidated({
        email: draft.email.trim(),
        address1: draft.address1.trim(),
        city: draft.city.trim(),
        last4: normalizedLast4,
      }),
    };

    if (!profileInput.name || !profileInput.email || !profileInput.address1 || !profileInput.city) {
      alert('Please fill out the name, email, city, and address fields.');
      return;
    }

    if (draft.secureCardAction === 'replace' && normalizedCardNumber) {
      if (!draft.cvv.trim() || !draft.expiryMonth?.trim() || !draft.expiryYear?.trim()) {
        alert('Full card updates need card number, CVV, expiry month, and expiry year.');
        return;
      }
    }

    const nextProfiles = editingProfileId
      ? profiles.map((profile) => (profile.id === editingProfileId ? { ...profile, ...profileInput } : profile))
      : [profileInput, ...profiles];

    await saveProfiles(nextProfiles);
    closeModal();
  };

  const handleDeleteProfile = async (id: string) => {
    const nextProfiles = profiles.filter((profile) => profile.id !== id);
    await saveProfiles(nextProfiles);
  };

  const handleImportCsv = async () => {
    const response = await window.electronAPI.importProfilesCsv();
    if (!response.success || response.canceled) {
      return;
    }

    setProfiles(response.profiles ?? []);
    alert(
      `Imported ${response.importedCount ?? 0} profiles. Secure vault card data is not restored from CSV, so add card number and CVV locally where needed.`,
    );
  };

  const handleExportCsv = async () => {
    const response = await window.electronAPI.exportProfilesCsv();
    if (!response.success || response.canceled) {
      return;
    }

    alert(`Exported ${response.exportedCount ?? profiles.length} profiles.`);
  };

  return (
    <div className="max-w-[1180px] space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <CreditCard size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest italic">Billing Profiles</h2>
            <p className="text-[10px] font-bold tracking-tight text-text-muted">
              Secure card payloads stay local and only hydrate inside the engine.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="SEARCH PROFILES..."
              className="w-64 rounded-xl border border-white/5 bg-surface/50 py-2.5 pl-10 pr-6 text-[10px] font-bold focus:border-primary/50 focus:outline-none"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl border border-valor-accent/20 bg-valor-accent/10 px-6 py-2.5 text-[10px] font-black uppercase italic text-valor-accent transition-all hover:bg-valor-accent/20"
          >
            <Plus size={14} />
            New Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="glass-card col-span-2 overflow-hidden border-white/5 bg-gradient-to-br from-white/[0.04] via-transparent to-emerald-500/[0.06]">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-[12px] font-black uppercase tracking-[0.28em] text-white/80">
                    CSV Import Guide
                  </h3>
                  <p className="mt-2 text-[10px] font-bold leading-relaxed text-white/30">
                    CSV can carry masked checkout metadata, but encrypted vault payloads stay local to this machine.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                    Safe Import Columns
                  </p>
                  <p className="mt-3 text-[10px] font-bold leading-relaxed text-white/30">
                    `name`, `email`, `address1`, `city`, `phone`, `province`, `zip`, `country`, `cardBrand`,
                    `cardHolder`, `expiryMonth`, `expiryYear`, `last4`
                  </p>
                </div>
                <div className="rounded-2xl border border-red-400/15 bg-red-500/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-200/80">
                    Never Imported From CSV
                  </p>
                  <p className="mt-3 text-[10px] font-bold leading-relaxed text-red-100/70">
                    Full card number and CVV do not come back from CSV export and are not restored on CSV import.
                    Add those in the local vault after import.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                Recommended Flow
              </p>
              <div className="mt-4 space-y-3 text-[10px] font-bold leading-relaxed text-white/32">
                <p>1. Import masked profile metadata from CSV.</p>
                <p>2. Open each imported profile that needs card automation.</p>
                <p>3. Add card number, CVV, and expiry inside the local secure vault section.</p>
                <p>4. Use those profiles for `CARD + AUTO` or `CARD + ASSIST` tasks.</p>
              </div>
            </div>
          </div>
        </div>

        {filteredProfiles.length === 0 && (
          <div className="glass-card col-span-2 border-dashed border-white/10 p-10 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/30">
              No profiles yet
            </p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
              Add one manually or import a CSV file.
            </p>
          </div>
        )}

        {filteredProfiles.map((profile) => (
          <div
            key={profile.id}
            className="glass-card group overflow-hidden border-white/5 transition-all hover:border-primary/30"
          >
            <div className="space-y-6 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-valor-accent p-[1px]">
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface">
                      <CreditCard size={20} className="text-primary" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider italic">{profile.name}</h4>
                    <p className="font-mono text-[10px] font-bold text-text-muted">
                      {(profile.cardBrand || 'CARD').toUpperCase()} **** {profile.last4 || '----'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1 ${
                      profile.validated ? 'text-valor-accent' : 'text-amber-300'
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    <span className="text-[9px] font-black uppercase italic">
                      {profile.validated ? 'Validated' : 'Incomplete'}
                    </span>
                  </div>
                  <button
                    onClick={() => openEditModal(profile)}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => void handleDeleteProfile(profile.id)}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MapPin size={14} className="text-text-muted" />
                    <div className="text-[10px] font-bold uppercase tracking-wide">
                      <p>{profile.city || 'Unknown City'}</p>
                      <p className="text-text-muted">{profile.address1 || 'No address saved'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail size={14} className="text-text-muted" />
                    <p className="truncate text-[10px] font-bold uppercase">{profile.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={14} className="text-text-muted" />
                    <p className="truncate text-[10px] font-bold uppercase">{profile.phone || 'No phone saved'}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between gap-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 transition-all group-hover:border-primary/30">
                      <Lock size={12} className="text-text-muted" />
                      <span className="text-[10px] font-black uppercase italic tracking-tighter">
                        Local Store
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
                        profile.hasSecureCard
                          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                          : 'border-white/10 bg-white/5 text-white/40'
                      }`}
                    >
                      <ShieldCheck size={12} />
                      <span className="text-[10px] font-black uppercase italic tracking-tighter">
                        {profile.hasSecureCard ? 'Vault Ready' : 'No Vault'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                      Holder: {profile.cardHolder || profile.name || 'N/A'}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">
                      EXP {profile.expiryMonth || '--'}/{profile.expiryYear || '--'}
                    </p>
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">
                      ID {profile.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-primary to-valor-accent opacity-30 transition-opacity group-hover:opacity-100" />
          </div>
        ))}
      </div>

      <div className="glass-card flex items-center justify-between border-dashed border-white/10 p-4">
        <p className="px-2 text-[10px] font-bold uppercase italic text-text-muted">
          CSV import/export keeps only masked card metadata. Secure vault payloads stay local to this app instance.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => void handleImportCsv()}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-[10px] font-black uppercase transition-all hover:bg-white/10"
          >
            <Upload size={12} />
            Import CSV
          </button>
          <button
            onClick={() => void handleExportCsv()}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-[10px] font-black uppercase transition-all hover:bg-white/10"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-[#0f0f11] shadow-3xl">
            <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-[0.2em] text-white">
                  {editingProfileId ? 'Edit Billing Profile' : 'New Billing Profile'}
                </h3>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Card number and CVV are encrypted locally before storage.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-2xl p-3 text-white/20 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-8 p-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((state) => ({ ...state, name: event.target.value }))}
                    placeholder="PROFILE NAME"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.email}
                    onChange={(event) => setDraft((state) => ({ ...state, email: event.target.value }))}
                    placeholder="EMAIL"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.phone}
                    onChange={(event) => setDraft((state) => ({ ...state, phone: event.target.value }))}
                    placeholder="PHONE"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.country}
                    onChange={(event) => setDraft((state) => ({ ...state, country: event.target.value }))}
                    placeholder="COUNTRY"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.city}
                    onChange={(event) => setDraft((state) => ({ ...state, city: event.target.value }))}
                    placeholder="CITY"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.province}
                    onChange={(event) => setDraft((state) => ({ ...state, province: event.target.value }))}
                    placeholder="STATE / PROVINCE"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.zip}
                    onChange={(event) => setDraft((state) => ({ ...state, zip: event.target.value }))}
                    placeholder="ZIP / POSTAL CODE"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.address1}
                    onChange={(event) => setDraft((state) => ({ ...state, address1: event.target.value }))}
                    placeholder="ADDRESS"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                </div>

                <input
                  value={draft.captchaApiKey}
                  onChange={(event) => setDraft((state) => ({ ...state, captchaApiKey: event.target.value }))}
                  placeholder="CAPTCHA API KEY (OPTIONAL)"
                  className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                />
              </div>

              <div className="space-y-5 rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/70">
                      Secure Card Vault
                    </p>
                    <p className="mt-2 text-[10px] font-bold leading-relaxed text-white/30">
                      Full card data only travels to main for local encryption and worker hydration.
                    </p>
                  </div>
                  {draft.hasSecureCard ? (
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">
                      Stored
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(['preserve', 'replace', 'remove'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDraft((state) => ({ ...state, secureCardAction: mode }))}
                      className={`rounded-2xl border px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                        draft.secureCardAction === mode
                          ? 'border-valor-accent/40 bg-valor-accent/10 text-valor-accent'
                          : 'border-white/10 bg-[#0a0a0b] text-white/35 hover:text-white/60'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <input
                    value={draft.cardBrand}
                    onChange={(event) => setDraft((state) => ({ ...state, cardBrand: event.target.value }))}
                    placeholder="CARD BRAND"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.cardHolder}
                    onChange={(event) => setDraft((state) => ({ ...state, cardHolder: event.target.value }))}
                    placeholder="CARD HOLDER"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.cardNumber}
                    onChange={(event) => setDraft((state) => ({ ...state, cardNumber: event.target.value }))}
                    placeholder="CARD NUMBER"
                    className="col-span-2 rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.expiryMonth}
                    onChange={(event) => setDraft((state) => ({ ...state, expiryMonth: event.target.value }))}
                    placeholder="MM"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.expiryYear}
                    onChange={(event) => setDraft((state) => ({ ...state, expiryYear: event.target.value }))}
                    placeholder="YYYY"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <input
                    value={draft.cvv}
                    onChange={(event) => setDraft((state) => ({ ...state, cvv: event.target.value }))}
                    placeholder="CVV"
                    className="rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                  <div className="flex items-center rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
                    Last 4: {draft.last4 || (draft.cardNumber ? draft.cardNumber.replace(/\D/g, '').slice(-4) : '----')}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 p-8">
              <button
                onClick={() => void handleUpsertProfile()}
                className="w-full rounded-[1.5rem] bg-valor-accent py-5 text-sm font-black uppercase italic tracking-[0.25em] text-white shadow-accent-glow transition-all hover:brightness-110 active:scale-[0.98]"
              >
                {editingProfileId ? 'Update Profile' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
