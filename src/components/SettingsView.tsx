import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store/app.ts'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export function SettingsView() {
    const { setEntries, setLastSynced, setIsSyncing, setDeviceLocation, theme, setTheme, fontSize, setFontSize, accentColor, setAccentColor } = useAppStore()
    const [serverUrl, setServerUrl] = useState('')
    const [username,  setUsername]  = useState('')
    const [password,  setPassword]  = useState('')

    const [syncInterval, setSyncInterval] = useState(() =>
        parseInt(localStorage.getItem('jtx_sync_interval') ?? '5', 10)
    )

    const [locName, setLocName] = useState('')
    const [locLat,  setLocLat]  = useState('')
    const [locLon,  setLocLon]  = useState('')
    const [locSaved, setLocSaved] = useState(false)

    // Load saved credentials on mount and apply persisted sync interval
    useEffect(() => {
        const savedMinutes = parseInt(localStorage.getItem('jtx_sync_interval') ?? '5', 10)
        window.api.sync.setInterval(savedMinutes)

        window.api.credentials.load().then(creds => {
            if (creds) {
                setServerUrl(creds.serverUrl)
                setUsername(creds.username)
                setPassword(creds.password)
            }
        })
    }, [])

    // Load saved default location on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem('jtx_default_location')
            if (!raw) return
            const loc = JSON.parse(raw) as { lat?: string; lon?: string; name?: string }
            setLocLat(loc.lat ?? '')
            setLocLon(loc.lon ?? '')
            setLocName(loc.name ?? '')
        } catch { /* ignore */ }
    }, [])

    const handleSaveLocation = () => {
        const loc = { lat: locLat.trim(), lon: locLon.trim(), name: locName.trim() || null }
        localStorage.setItem('jtx_default_location', JSON.stringify(loc))
        if (loc.lat && loc.lon) setDeviceLocation({ lat: loc.lat, lon: loc.lon, name: loc.name ?? null })
        setLocSaved(true)
        setTimeout(() => setLocSaved(false), 2000)
    }
    const [status,    setStatus]    = useState<'idle' | 'testing' | 'syncing' | 'ok' | 'error'>('idle')
    const [message,   setMessage]   = useState<string | null>(null)

    const handleTest = async () => {
        setStatus('testing')
        setMessage(null)
        const result = await window.api.sync.testConnection({ serverUrl, username, password })
        if (result.ok) {
            setStatus('ok')
            setMessage('Connection successful')
        } else {
            setStatus('error')
            setMessage(result.error ?? 'Connection failed')
        }
    }

    const handleSave = async () => {
        setStatus('syncing')
        setMessage('Saving credentials and syncing…')
        setIsSyncing(true)
        try {
            await window.api.credentials.save({ serverUrl, username, password })
            await window.api.sync.setCredentials({ serverUrl, username, password })
            const result = await window.api.sync.now()
            if (result.state === 'error') {
                setStatus('error')
                setMessage('Sync failed — check your credentials')
                return
            }
            const entries = await window.api.entries.getAll()
            setEntries(entries)
            if (result.last_synced_at) setLastSynced(result.last_synced_at)
            setStatus('ok')
            setMessage(`Sync complete — ${entries.length} entries loaded`)
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div style={{
            flex:       1,
            overflowY:  'auto',
            padding:    '40px 48px',
        }}>
            {/* Appearance section */}
            <div style={{ maxWidth: '480px', marginBottom: '40px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 400, color: 'var(--text-primary)', marginBottom: '24px' }}>
                    Appearance
                </h2>

                {/* Theme */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Theme
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {(['dark', 'light', 'system'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setTheme(t)}
                                style={{
                                    flex: 1, padding: '10px 0',
                                    background: theme === t ? 'var(--accent-glow)' : 'var(--bg-raised)',
                                    border: `1px solid ${theme === t ? 'var(--accent-dim)' : 'var(--border-strong)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    color: theme === t ? 'var(--accent)' : 'var(--text-secondary)',
                                    fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer',
                                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                                }}
                            >
                                {t === 'dark' ? '🌙 Dark' : t === 'light' ? '☀️ Light' : '⚙ System'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Accent color */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Accent color
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {['#c4a35a', '#5a9ea0', '#c45a5a', '#7a9e7a', '#9a8ac4', '#a05a8a'].map(color => (
                            <button
                                key={color}
                                onClick={() => setAccentColor(color)}
                                title={color}
                                style={{
                                    width: '28px', height: '28px',
                                    borderRadius: '50%',
                                    background: color,
                                    border: accentColor === color
                                        ? '2px solid var(--text-primary)'
                                        : '2px solid transparent',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    boxShadow: accentColor === color ? '0 0 0 1px var(--bg-base)' : 'none',
                                    flexShrink: 0,
                                }}
                            />
                        ))}
                        <label title="Custom color" style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0, cursor: 'pointer' }}>
                            <input
                                type="color"
                                value={accentColor}
                                onChange={e => setAccentColor(e.target.value)}
                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                            />
                            <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                                border: '2px solid var(--border-strong)',
                            }} />
                        </label>
                    </div>
                </div>

                {/* Font size */}
                <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Font size
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {([['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['xl', 'X-Large']] as const).map(([s, label]) => (
                            <button
                                key={s}
                                onClick={() => setFontSize(s)}
                                style={{
                                    flex: 1, padding: '10px 0',
                                    background: fontSize === s ? 'var(--accent-glow)' : 'var(--bg-raised)',
                                    border: `1px solid ${fontSize === s ? 'var(--accent-dim)' : 'var(--border-strong)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    color: fontSize === s ? 'var(--accent)' : 'var(--text-secondary)',
                                    fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer',
                                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '40px', marginBottom: '8px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 400, color: 'var(--text-primary)', marginBottom: '24px' }}>
                    Nextcloud Sync
                </h2>
            </div>

            {/* Sync interval */}
            <div style={{ maxWidth: '480px', marginBottom: '28px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Sync interval
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {[5, 10, 15, 30, 60].map(m => (
                        <button
                            key={m}
                            onClick={() => {
                                setSyncInterval(m)
                                localStorage.setItem('jtx_sync_interval', String(m))
                                window.api.sync.setInterval(m)
                            }}
                            style={{
                                padding: '8px 14px',
                                background: syncInterval === m ? 'var(--accent-glow)' : 'var(--bg-raised)',
                                border: `1px solid ${syncInterval === m ? 'var(--accent-dim)' : 'var(--border-strong)'}`,
                                borderRadius: 'var(--radius-md)',
                                color: syncInterval === m ? 'var(--accent)' : 'var(--text-secondary)',
                                fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer',
                                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                            }}
                        >
                            {m < 60 ? `${m}m` : '1h'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Form */}
            <div style={{
                maxWidth:  '480px',
                display:   'flex',
                flexDirection: 'column',
                gap:       '20px',
            }}>
                <Field
                    label="Nextcloud URL"
                    placeholder="https://nextcloud.example.com"
                    value={serverUrl}
                    onChange={setServerUrl}
                    type="url"
                />
                <Field
                    label="Username"
                    placeholder="your-username"
                    value={username}
                    onChange={setUsername}
                />
                <Field
                    label="Password or App Password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={setPassword}
                    type="password"
                />

                {/* Status message */}
                {message && (
                    <div style={{
                        padding:      '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize:     '13px',
                        background:   status === 'error'
                            ? 'rgba(192, 64, 64, 0.12)'
                            : 'rgba(74, 124, 74, 0.12)',
                        color: status === 'error'
                            ? '#e07070'
                            : '#70c070',
                        border: `1px solid ${status === 'error'
                            ? 'rgba(192,64,64,0.3)'
                            : 'rgba(74,124,74,0.3)'}`,
                    }}>
                        {message}
                    </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ActionButton
                        label="Test Connection"
                        onClick={handleTest}
                        disabled={!serverUrl || !username || !password || status === 'testing' || status === 'syncing'}
                        variant="secondary"
                    />
                    <ActionButton
                        label={status === 'syncing' ? 'Syncing…' : 'Save & Sync'}
                        onClick={handleSave}
                        disabled={!serverUrl || !username || !password || status === 'testing' || status === 'syncing'}
                        variant="primary"
                    />
                </div>

                {/* Reset sync cache */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '8px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
                        Force a full re-download of all entries from the server. Use this if
                        fields like location or geo coordinates are missing after an update.
                    </p>
                    <ActionButton
                        label="Reset Sync Cache & Re-sync"
                        onClick={async () => {
                            setStatus('syncing')
                            setMessage('Clearing cache and re-syncing all entries…')
                            setIsSyncing(true)
                            try {
                                await window.api.sync.resetCache()
                                const result = await window.api.sync.now()
                                const entries = await window.api.entries.getAll()
                                setEntries(entries)
                                if (result.last_synced_at) setLastSynced(result.last_synced_at)
                                setStatus('ok')
                                setMessage(`Re-sync complete — ${entries.length} entries loaded`)
                            } catch {
                                setStatus('error')
                                setMessage('Re-sync failed')
                            } finally {
                                setIsSyncing(false)
                            }
                        }}
                        disabled={status === 'testing' || status === 'syncing'}
                        variant="secondary"
                    />
                </div>

                {/* Default location */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                            Default location
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Pre-filled on every new entry. Leave blank to skip.
                        </div>
                    </div>

                    <MapPicker
                        lat={locLat}
                        lon={locLon}
                        onChange={(lat, lon) => { setLocLat(lat); setLocLon(lon) }}
                    />

                    <Field
                        label="Location name"
                        placeholder="Hamburg, Germany"
                        value={locName}
                        onChange={setLocName}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <Field label="Latitude"  placeholder="53.550341"  value={locLat} onChange={setLocLat} />
                        <Field label="Longitude" placeholder="10.000654" value={locLon} onChange={setLocLon} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ActionButton
                            label="Save location"
                            onClick={handleSaveLocation}
                            disabled={false}
                            variant="primary"
                        />
                        {locSaved && (
                            <span style={{ fontSize: '12px', color: '#70c070' }}>Saved</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
                   label, placeholder, value, onChange, type = 'text'
               }: {
    label:       string
    placeholder: string
    value:       string
    onChange:    (v: string) => void
    type?:       string
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{
                fontSize:      '12px',
                color:         'var(--text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
            }}>
                {label}
            </label>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{
                    background:   'var(--bg-raised)',
                    border:       '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    color:        'var(--text-primary)',
                    fontFamily:   'var(--font-ui)',
                    fontSize:     '13px',
                    padding:      '10px 12px',
                    outline:      'none',
                    transition:   'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-dim)'}
                onBlur={e  => e.target.style.borderColor = 'var(--border-strong)'}
            />
        </div>
    )
}

// ── Map picker ────────────────────────────────────────────────────────────────

// Custom pin icon — avoids Leaflet's default marker image path issues in Vite
const pinHtml = () => {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c4a35a'
    return `<div style="width:14px;height:14px;background:${c};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`
}

function MapPicker({ lat, lon, onChange }: {
    lat:      string
    lon:      string
    onChange: (lat: string, lon: string) => void
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef       = useRef<L.Map | null>(null)
    const markerRef    = useRef<L.Marker | null>(null)
    const onChangeRef  = useRef(onChange)
    useEffect(() => { onChangeRef.current = onChange }, [onChange])

    // Initialize map once on mount
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return

        const initLat = parseFloat(lat) || 53.5503
        const initLon = parseFloat(lon) || 10.0006

        const pinIcon = L.divIcon({ className: '', html: pinHtml(), iconSize: [14, 14], iconAnchor: [7, 7] })

        const map    = L.map(containerRef.current).setView([initLat, initLon], 12)
        const marker = L.marker([initLat, initLon], { icon: pinIcon }).addTo(map)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map)

        map.on('click', (e: L.LeafletMouseEvent) => {
            marker.setLatLng(e.latlng)
            onChangeRef.current(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6))
        })

        mapRef.current    = map
        markerRef.current = marker

        return () => {
            map.remove()
            mapRef.current    = null
            markerRef.current = null
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Sync marker position when lat/lon are edited via the text inputs
    useEffect(() => {
        if (!markerRef.current) return
        const latNum = parseFloat(lat)
        const lonNum = parseFloat(lon)
        if (isNaN(latNum) || isNaN(lonNum)) return
        markerRef.current.setLatLng([latNum, lonNum])
        mapRef.current?.panTo([latNum, lonNum])
    }, [lat, lon])

    return (
        <div
            ref={containerRef}
            style={{
                width:        '100%',
                height:       '280px',
                borderRadius: 'var(--radius-md)',
                overflow:     'hidden',
                border:       '1px solid var(--border)',
            }}
        />
    )
}

function ActionButton({
                          label, onClick, disabled, variant
                      }: {
    label:    string
    onClick:  () => void
    disabled: boolean
    variant:  'primary' | 'secondary'
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding:      '10px 20px',
                borderRadius: 'var(--radius-md)',
                border:       variant === 'primary'
                    ? '1px solid var(--accent-dim)'
                    : '1px solid var(--border-strong)',
                background:   variant === 'primary'
                    ? 'var(--accent-glow)'
                    : 'var(--bg-raised)',
                color:        variant === 'primary'
                    ? 'var(--accent)'
                    : 'var(--text-secondary)',
                fontFamily:   'var(--font-ui)',
                fontSize:     '13px',
                cursor:       disabled ? 'not-allowed' : 'pointer',
                opacity:      disabled ? 0.5 : 1,
                transition:   'background 0.15s, opacity 0.15s',
            }}
        >
            {label}
        </button>
    )
}