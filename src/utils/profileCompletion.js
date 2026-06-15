const calcProfileCompletion = (u) => {
    if (!u) return { percent: 0, filled: 0, total: 12, missing: [] }

    const checks = [
        { key: 'alias', label: 'Alias', ok: !!u.alias },
        { key: 'age', label: 'Age', ok: !!u.age },
        { key: 'gender', label: 'Gender', ok: !!u.gender },
        { key: 'bio', label: 'Bio', ok: !!u.bio?.trim() },
        { key: 'city', label: 'City', ok: !!u.city },
        { key: 'profession', label: 'Profession', ok: !!u.profession },
        { key: 'desire_archetype', label: 'Desire DNA', ok: !!u.desire_archetype },
        { key: 'seeking', label: 'Preferences', ok: !!u.seeking },
        { key: 'photos', label: 'Photos', ok: (u.photo_urls?.length || 0) >= 1 },
        { key: 'photos3', label: '3+ photos', ok: (u.photo_urls?.length || 0) >= 3 },
        { key: 'avatar', label: 'Avatar', ok: !!u.avatar_url },
        { key: 'desire_tags', label: 'Desire tags', ok: (u.desire_tags?.length || 0) >= 2 },
    ]

    const filled = checks.filter(c => c.ok).length
    const missing = checks.filter(c => !c.ok).map(c => c.label)
    const percent = Math.round((filled / checks.length) * 100)

    return { percent, filled, total: checks.length, missing, photoCount: u.photo_urls?.length || 0 }
}

module.exports = { calcProfileCompletion }
