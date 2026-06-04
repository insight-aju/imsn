# imsn-web v1.0.0-client-standalone — README técnico

## Objetivo

Fechar o cliente Web/PWA como entregável standalone antes da entrada do imsn-server.

## Funcionamento atual

- Web/PWA funciona sem imsn-server.
- Comunicação base via broker MQTT.
- Compatível com Web/PWA ↔ Web/PWA.
- Compatível com Web/PWA ↔ ESP.
- ESP ↔ ESP continua independente.

## Política preparada

Esta versão já possui `state.server_policy`:

```js
{
  mode: 0,
  label: "Standalone",
  server_url: "",
  server_seen: false,
  broker_id: "hivemq-public",
  broker_authorized: true,
  policy_id: "",
  min_web_version: "",
  update_url: "",
  require_server: false,
  last_check: null
}
```

Modos planejados:

```txt
0 = sem servidor / standalone permitido
1 = servidor ativo / uso gerenciado obrigatório
2 = servidor ativo / broker direto permitido
```

As mensagens ficam preparadas com `server_guard`, `client_type` e `client_version`.

Nesta versão, o servidor ainda não é obrigatório.
