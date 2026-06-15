  const resolved = resolveStockUnits(poolCandidates, count, (pool) => {
    return pickPackAccessoryForWeapon(weapon, pool, kind)
  })