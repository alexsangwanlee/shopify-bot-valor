import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Gauge,
  Globe,
  MoreVertical,
  Plus,
  Radar,
  ShieldCheck,
  Trash2,
  Upload,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { ProxyEntry, ProxyGroup } from '@core/app-data';

type ProxyTab = 'groups' | 'speed';
type RecommendationTone = 'prime' | 'strong' | 'mixed' | 'untested' | 'offline';

type RankedProxyGroup = ProxyGroup & {
  averageLatency?: number;
  fastestLatency?: number;
  measuredCount: number;
  validCount: number;
  timeoutCount: number;
  recommendationScore: number;
  recommendationTone: RecommendationTone;
  recommendationLabel: string;
  recommendationReason: string;
};

function formatLatency(latencyMs?: number) {
  if (typeof latencyMs !== 'number') {
    return '--';
  }

  return `${latencyMs} ms`;
}

function getLatencyTone(latencyMs?: number) {
  if (typeof latencyMs !== 'number') {
    return 'text-white/25';
  }

  if (latencyMs <= 900) {
    return 'text-emerald-300';
  }

  if (latencyMs <= 2000) {
    return 'text-amber-300';
  }

  return 'text-red-300';
}

function getRecommendationTheme(tone: RecommendationTone) {
  switch (tone) {
    case 'prime':
      return {
        badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
        text: 'text-emerald-200',
      };
    case 'strong':
      return {
        badge: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
        text: 'text-cyan-200',
      };
    case 'mixed':
      return {
        badge: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
        text: 'text-amber-200',
      };
    case 'offline':
      return {
        badge: 'border-red-400/20 bg-red-400/10 text-red-200',
        text: 'text-red-200',
      };
    default:
      return {
        badge: 'border-white/10 bg-white/[0.04] text-white/60',
        text: 'text-white/60',
      };
  }
}

function summarizeGroup(group: ProxyGroup): RankedProxyGroup {
  const measured = group.entries.filter((entry) => typeof entry.latencyMs === 'number');
  const validEntries = group.entries.filter((entry) => entry.status === 'valid');
  const timeoutCount = group.entries.filter(
    (entry) => entry.status === 'invalid' && typeof entry.latencyMs !== 'number',
  ).length;
  const averageLatency =
    measured.length > 0
      ? Math.round(measured.reduce((sum, entry) => sum + (entry.latencyMs ?? 0), 0) / measured.length)
      : undefined;
  const fastestLatency =
    measured.length > 0
      ? Math.min(...measured.map((entry) => entry.latencyMs ?? Number.MAX_SAFE_INTEGER))
      : undefined;
  const validRatio = group.entries.length > 0 ? validEntries.length / group.entries.length : 0;
  const measuredRatio = group.entries.length > 0 ? measured.length / group.entries.length : 0;
  const latencyScore =
    typeof averageLatency === 'number' ? Math.max(0, 100 - Math.round(averageLatency / 20)) : 0;
  const fastestBonus =
    typeof fastestLatency === 'number' ? Math.max(0, 25 - Math.round(fastestLatency / 80)) : 0;
  const recommendationScore = Math.round(
    validRatio * 120 +
      measuredRatio * 45 +
      latencyScore +
      fastestBonus -
      timeoutCount * 12 -
      Math.max(0, group.entries.length - validEntries.length) * 6,
  );

  let recommendationTone: RecommendationTone = 'untested';
  let recommendationLabel = 'UNTESTED';
  let recommendationReason = 'Run Speed Lab once to benchmark this pool.';

  if (group.entries.length === 0 || validEntries.length === 0) {
    recommendationTone = group.entries.length === 0 ? 'untested' : 'offline';
    recommendationLabel = group.entries.length === 0 ? 'UNTESTED' : 'OFFLINE';
    recommendationReason =
      group.entries.length === 0
        ? 'This group has no proxies loaded yet.'
        : 'No live proxies are available for rotation right now.';
  } else if (measured.length === 0) {
    recommendationTone = 'untested';
    recommendationLabel = 'UNTESTED';
    recommendationReason = 'Live proxies found, but no latency sample exists yet.';
  } else if (validRatio >= 0.9 && (averageLatency ?? Number.MAX_SAFE_INTEGER) <= 1200) {
    recommendationTone = 'prime';
    recommendationLabel = 'RECOMMENDED';
    recommendationReason = `Best rotation candidate with ${validEntries.length}/${group.entries.length} live proxies and ${averageLatency} ms average latency.`;
  } else if (validRatio >= 0.65 && (averageLatency ?? Number.MAX_SAFE_INTEGER) <= 1900) {
    recommendationTone = 'strong';
    recommendationLabel = 'STRONG';
    recommendationReason = `Reliable backup pool with ${formatLatency(averageLatency)} average speed.`;
  } else {
    recommendationTone = 'mixed';
    recommendationLabel = 'MIXED';
    recommendationReason = `Usable pool, but failures or slower responses may reduce catch rate.`;
  }

  return {
    ...group,
    averageLatency,
    fastestLatency,
    measuredCount: measured.length,
    validCount: validEntries.length,
    timeoutCount,
    recommendationScore,
    recommendationTone,
    recommendationLabel,
    recommendationReason,
  };
}

export const Proxies: React.FC = () => {
  const [groups, setGroups] = useState<ProxyGroup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [activeTab, setActiveTab] = useState<ProxyTab>('groups');
  const [speedTargetUrl, setSpeedTargetUrl] = useState('https://www.supremenewyork.com/shop/all');
  const [speedGroupId, setSpeedGroupId] = useState('all');
  const [isTestingSpeed, setIsTestingSpeed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [proxyGroups, config] = await Promise.all([
        window.electronAPI.getProxyGroups(),
        window.electronAPI.getConfig(),
      ]);
      setGroups(proxyGroups);
      setSpeedTargetUrl(config.proxySpeedTestUrl);
    };

    void load();
  }, []);

  const totalProxyCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.entries.length, 0),
    [groups],
  );

  const validProxyCount = useMemo(
    () =>
      groups.reduce(
        (sum, group) => sum + group.entries.filter((entry) => entry.status === 'valid').length,
        0,
      ),
    [groups],
  );

  const invalidProxyCount = totalProxyCount - validProxyCount;

  const rankedGroups = useMemo(() => {
    return groups
      .map((group) => summarizeGroup(group))
      .sort((left, right) => {
        if (left.recommendationScore !== right.recommendationScore) {
          return right.recommendationScore - left.recommendationScore;
        }

        return left.name.localeCompare(right.name);
      });
  }, [groups]);

  const recommendedGroup = useMemo(
    () =>
      rankedGroups.find(
        (group) => group.measuredCount > 0 && group.validCount > 0 && group.recommendationTone !== 'mixed',
      ) ??
      rankedGroups.find((group) => group.measuredCount > 0 && group.validCount > 0) ??
      null,
    [rankedGroups],
  );

  const recentEntries = useMemo(
    () =>
      [...groups.flatMap((group) => group.entries.map((entry) => ({ ...entry, groupName: group.name, groupId: group.id })))]
        .sort((left, right) => (right.lastCheckedAt ?? 0) - (left.lastCheckedAt ?? 0))
        .slice(0, 8),
    [groups],
  );

  const speedEntries = useMemo(() => {
    return [...rankedGroups.flatMap((group) => group.entries.map((entry) => ({ ...entry, groupName: group.name, groupId: group.id })))]
      .filter((entry) => speedGroupId === 'all' || entry.groupId === speedGroupId)
      .sort((left, right) => {
        const leftLatency = left.latencyMs ?? Number.MAX_SAFE_INTEGER;
        const rightLatency = right.latencyMs ?? Number.MAX_SAFE_INTEGER;
        return leftLatency - rightLatency;
      });
  }, [rankedGroups, speedGroupId]);

  const speedStats = useMemo(() => {
    const measured = speedEntries.filter((entry) => typeof entry.latencyMs === 'number');
    const average =
      measured.length > 0
        ? Math.round(measured.reduce((sum, entry) => sum + (entry.latencyMs ?? 0), 0) / measured.length)
        : undefined;

    return {
      measured: measured.length,
      fastest: measured[0]?.latencyMs,
      average,
      timedOut: speedEntries.filter((entry) => entry.status === 'invalid' && !entry.latencyMs).length,
    };
  }, [speedEntries]);

  const handleCreateGroup = async () => {
    if (!groupName.trim() || !rawInput.trim()) {
      alert('Please provide a group name and at least one proxy line.');
      return;
    }

    const response = await window.electronAPI.createProxyGroup({
      name: groupName,
      rawInput,
    });

    if (!response.success) {
      return;
    }

    setGroups(response.groups ?? []);
    setGroupName('');
    setRawInput('');
    setIsModalOpen(false);
  };

  const handleRemoveGroup = async (id: string) => {
    const response = await window.electronAPI.removeProxyGroup(id);
    if (!response.success) {
      return;
    }

    setGroups(response.groups ?? []);
  };

  const handleValidateAll = async () => {
    const response = await window.electronAPI.validateProxyGroups();
    if (!response.success) {
      return;
    }

    setGroups(response.groups ?? []);
  };

  const handleRunSpeedTest = async () => {
    setIsTestingSpeed(true);
    try {
      const response = await window.electronAPI.testProxySpeeds({
        groupId: speedGroupId === 'all' ? undefined : speedGroupId,
        targetUrl: speedTargetUrl,
      });

      if (!response.success) {
        alert(response.error || 'Proxy speed test failed.');
        return;
      }

      setGroups(response.groups ?? []);
      setActiveTab('speed');
    } finally {
      setIsTestingSpeed(false);
    }
  };

  const getGroupStatus = (group: ProxyGroup) => {
    const validCount = group.entries.filter((entry) => entry.status === 'valid').length;
    if (group.entries.length === 0) {
      return { label: 'EMPTY', color: 'text-white/30' };
    }

    if (validCount === group.entries.length) {
      return { label: 'READY', color: 'text-valor-accent' };
    }

    if (validCount === 0) {
      return { label: 'INVALID', color: 'text-red-400' };
    }

    return { label: 'MIXED', color: 'text-amber-300' };
  };

  return (
    <div className="max-w-[1120px] space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-valor-accent/10 p-2.5 text-valor-accent shadow-accent-glow">
            <Globe size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest italic">Proxy Management</h2>
            <p className="text-[10px] font-bold tracking-tight text-text-muted">
              TOTAL: {totalProxyCount} / VALID: {validProxyCount} / INVALID: {invalidProxyCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-1.5">
          {([
            { id: 'groups', label: 'Groups' },
            { id: 'speed', label: 'Speed Lab' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-5 py-2.5 text-[10px] font-black uppercase italic tracking-[0.22em] transition-all ${
                activeTab === tab.id
                  ? 'bg-valor-accent text-white shadow-accent-glow'
                  : 'text-white/30 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'groups' && (
        <>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => void handleValidateAll()}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-[10px] font-black uppercase italic transition-all hover:bg-white/10"
            >
              <Upload size={12} />
              Parse & Validate
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-valor-accent/20 bg-valor-accent/10 px-6 py-2.5 text-[10px] font-black uppercase italic text-valor-accent transition-all hover:bg-valor-accent/20"
            >
              <Plus size={14} />
              Add Group
            </button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {groups.length === 0 && (
              <div className="glass-card col-span-3 border-dashed border-white/10 p-10 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/30">
                  No proxy groups loaded
                </p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Add a group to populate the shared proxy pool.
                </p>
              </div>
            )}

            {rankedGroups.map((group, index) => {
              const status = getGroupStatus(group);
              const theme = getRecommendationTheme(group.recommendationTone);

              return (
                <div
                  key={group.id}
                  className="glass-card group relative overflow-hidden p-6 transition-all hover:border-white/10"
                >
                  <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/40">
                    #{index + 1}
                  </div>
                  <div className="absolute right-0 top-0 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <MoreVertical size={14} className="text-text-muted" />
                  </div>
                  <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-lg bg-white/5 p-2 text-text-muted">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase italic tracking-wider">{group.name}</h4>
                      <p className="text-[10px] font-bold uppercase text-text-muted">
                        {group.entries.length} proxies loaded
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 ${status.color}`}>
                          <Zap size={12} />
                          <span className="text-[10px] font-black italic">{status.label}</span>
                        </div>
                        <p className="text-[10px] font-bold uppercase text-white/30">
                          {group.validCount}/{group.entries.length} ready for rotation
                        </p>
                      </div>
                      <button
                        onClick={() => void handleRemoveGroup(group.id)}
                        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.22em] text-white/30">
                        <span>Average Latency</span>
                        <span className={getLatencyTone(group.averageLatency)}>{formatLatency(group.averageLatency)}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] ${theme.badge}`}>
                          {group.recommendationLabel}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                          score {group.recommendationScore}
                        </span>
                      </div>
                      <p className={`mt-3 text-[10px] font-bold leading-relaxed ${theme.text}`}>
                        {group.recommendationReason}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/5 p-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest italic text-text-muted">
                Recent Validation
              </h4>
              <span className="text-[10px] font-bold text-valor-accent">Shared task pool synced</span>
            </div>
            <div className="space-y-4 p-6">
              {recentEntries.length === 0 && (
                <div className="py-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Validation history will appear after you add a group.
                </div>
              )}

              {recentEntries.map((entry) => (
                <ProxyValidationRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'speed' && (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="glass-card space-y-5 border-white/5 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
                  <Radar size={20} />
                </div>
                <div>
                  <h3 className="text-[12px] font-black uppercase tracking-[0.24em] text-white/80">
                    Speed Lab
                  </h3>
                  <p className="mt-2 text-[10px] font-bold leading-relaxed text-white/30">
                    Run real store requests through proxies and rank them by actual response time.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-3">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                    Target URL
                  </label>
                  <input
                    type="text"
                    value={speedTargetUrl}
                    onChange={(event) => setSpeedTargetUrl(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-bold text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                    Group Scope
                  </label>
                  <select
                    value={speedGroupId}
                    onChange={(event) => setSpeedGroupId(event.target.value)}
                    className="cursor-pointer appearance-none rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white transition-all focus:border-valor-accent/50 focus:outline-none"
                  >
                    <option value="all" className="bg-[#0f0f11]">
                      ALL GROUPS
                    </option>
                    {rankedGroups.map((group) => (
                      <option key={group.id} value={group.id} className="bg-[#0f0f11] uppercase">
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => void handleRunSpeedTest()}
                disabled={isTestingSpeed || groups.length === 0}
                className="w-full rounded-[1.5rem] bg-cyan-400/90 py-5 text-sm font-black uppercase italic tracking-[0.25em] text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.35)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isTestingSpeed ? 'Testing Proxy Speeds...' : 'Run Speed Test'}
              </button>

              <div className="rounded-[1.75rem] border border-white/5 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/30">
                      Recommended Group
                    </p>
                    <h4 className="mt-2 text-lg font-black uppercase italic text-white">
                      {recommendedGroup?.name ?? 'No recommendation yet'}
                    </h4>
                  </div>
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                    <Gauge size={18} />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {recommendedGroup ? (
                    <>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                        <span>Average</span>
                        <span className={getLatencyTone(recommendedGroup.averageLatency)}>
                          {formatLatency(recommendedGroup.averageLatency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                        <span>Measured</span>
                        <span className="text-white/70">{recommendedGroup.measuredCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                        <span>Live Proxies</span>
                        <span className="text-white/70">
                          {recommendedGroup.validCount}/{recommendedGroup.entries.length}
                        </span>
                      </div>
                      <p className={`pt-2 text-[10px] font-bold leading-relaxed ${getRecommendationTheme(recommendedGroup.recommendationTone).text}`}>
                        {recommendedGroup.recommendationReason}
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] font-bold leading-relaxed text-white/30">
                      Run Speed Lab to rank groups and surface the best pool for monitor and checkout traffic.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Wifi, label: 'Measured', value: speedStats.measured },
                { icon: Gauge, label: 'Fastest', value: formatLatency(speedStats.fastest) },
                { icon: Activity, label: 'Average', value: formatLatency(speedStats.average) },
                { icon: Zap, label: 'Timeouts', value: speedStats.timedOut },
              ].map((card) => (
                <div key={card.label} className="glass-card border-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/30">
                      {card.label}
                    </span>
                    <card.icon size={16} className="text-cyan-300" />
                  </div>
                  <div className="mt-6 text-2xl font-black italic text-white">{card.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card overflow-hidden border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/5 p-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest italic text-text-muted">
                Group Recommendation Ladder
              </h4>
              <span className="text-[10px] font-bold text-cyan-300">
                Sorted by Speed Lab health, live ratio, and average latency
              </span>
            </div>

            <div className="space-y-3 p-5">
              {rankedGroups.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white/25">
                  Add proxy groups to generate recommendations.
                </div>
              )}

              {rankedGroups.map((group, index) => {
                const theme = getRecommendationTheme(group.recommendationTone);

                return (
                  <div
                    key={group.id}
                    className="grid grid-cols-[58px_1.1fr_120px_120px_140px] items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4"
                  >
                    <div className="text-[12px] font-black italic text-white/25">#{index + 1}</div>
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-white/80">
                        {group.name}
                      </div>
                      <div className={`mt-1 text-[10px] font-bold leading-relaxed ${theme.text}`}>
                        {group.recommendationReason}
                      </div>
                    </div>
                    <div className={`text-[11px] font-black uppercase tracking-[0.18em] ${getLatencyTone(group.averageLatency)}`}>
                      {formatLatency(group.averageLatency)}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
                      {group.validCount}/{group.entries.length} live
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] ${theme.badge}`}>
                        {group.recommendationLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card overflow-hidden border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/5 p-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest italic text-text-muted">
                Speed Ranking
              </h4>
              <span className="text-[10px] font-bold text-cyan-300">
                Sorted by actual latency against the target URL
              </span>
            </div>

            <div className="space-y-3 p-5">
              {speedEntries.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white/25">
                  Run a speed test to rank proxies here.
                </div>
              )}

              {speedEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[56px_1fr_120px_120px] items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4"
                >
                  <div className="text-[12px] font-black italic text-white/25">#{index + 1}</div>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] text-white/70">{entry.raw}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/20">
                      {entry.groupName}
                    </div>
                  </div>
                  <div className={`text-[11px] font-black uppercase tracking-[0.18em] ${getLatencyTone(entry.latencyMs)}`}>
                    {formatLatency(entry.latencyMs)}
                  </div>
                  <div
                    className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                      entry.status === 'valid' ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {entry.status === 'valid' ? 'LIVE' : entry.error ?? 'FAILED'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#0f0f11] shadow-3xl">
            <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-[0.2em] text-white">
                  New Proxy Group
                </h3>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Paste one proxy per line using host:port or host:port:user:pass
                </p>
              </div>
              <button
                onClick={() => {
                  setGroupName('');
                  setRawInput('');
                  setIsModalOpen(false);
                }}
                className="rounded-2xl p-3 text-white/20 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-8">
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="GROUP NAME"
                className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-black uppercase italic text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
              />
              <textarea
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder={'127.0.0.1:8080\n127.0.0.1:8080:user:pass'}
                rows={12}
                className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 font-mono text-xs text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
              />
            </div>

            <div className="border-t border-white/5 p-8">
              <button
                onClick={() => void handleCreateGroup()}
                className="w-full rounded-[1.5rem] bg-valor-accent py-5 text-sm font-black uppercase italic tracking-[0.25em] text-white shadow-accent-glow transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Save Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProxyValidationRow: React.FC<{ entry: ProxyEntry & { groupName: string } }> = ({ entry }) => {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 last:border-0">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[11px] text-text">{entry.raw}</span>
        <span className="rounded bg-white/5 px-2 py-0.5 text-[9px] font-black italic text-white/50">
          {entry.groupName}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className={`text-[11px] font-bold italic ${getLatencyTone(entry.latencyMs)}`}>
          {formatLatency(entry.latencyMs)}
        </span>
        <span
          className={`text-[11px] font-bold italic ${
            entry.status === 'valid' ? 'text-valor-accent' : 'text-red-400'
          }`}
        >
          {entry.status === 'valid' ? 'VALID' : entry.error ?? 'INVALID'}
        </span>
      </div>
    </div>
  );
};
