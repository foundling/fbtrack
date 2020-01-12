const listFormatter = sep => (items, fn=x=>x) => {
  return items.map(i => ` ${sep} ${fn(i)}`).join('\n')
}

module.exports = exports = {
  listFormatter
}
