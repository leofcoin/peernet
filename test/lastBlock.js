peernet.addRequestHandler('lastBlock', () => {
  let response;
  const height = await chainStore.get('localIndex')
  const hash = await chainStore.get('localBlock')
  response = JSON.stringify({ height: height.toString(), hash: hash.toString() })
  return new peernet.protos['peernet-response']({ response })
})
