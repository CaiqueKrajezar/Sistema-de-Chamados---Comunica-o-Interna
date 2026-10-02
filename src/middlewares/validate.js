"use strict";

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        erro: "Dados inválidos.",
        detalhes: result.error.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message }))
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
