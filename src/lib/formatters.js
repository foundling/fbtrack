const listFormatter = sep => (items, fn=x=>x) => {
  return items.map(i => ` ${sep} ${fn(i)}`).join('\n')
}

const splitArgsOn = sep => s => s.split(sep).filter(Boolean)

module.exports = exports = {
  listFormatter,
  splitArgsOn,
}
