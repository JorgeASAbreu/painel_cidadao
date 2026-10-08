export function createLocationController(locationService) {
  return {
    byCep: async (req, res) => {
      const snapshot = await locationService.lookup(req.params.cep);
      return res.json({ data: snapshot, status: snapshot.status, warnings: snapshot.warnings });
    },
  };
}
