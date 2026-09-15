# Pulse: dagelijks gebruik eerst

Prioriteit gewijzigd op verzoek van Stef: geen verdere Strava-detailronde.
Doel is een bruikbare persoonlijke app en een gecontroleerde livegang, niet
alle verbeterpunten afwerken voordat dagelijks gebruik mogelijk is.

## Nu afronden

- [ ] Lokale homepage-fout in de browsercontrole oplossen/verifiëren. De pagina
  blokkeert geheel bij een schemaweek-fout; oorzaak van die fout nog vaststellen.
- [ ] Kernflow op de release testen: inloggen, dashboard, schema, workoutdetails,
  check-in, voortgang en bestaande chats.
- [ ] Chat versturen en schemawijziging controleren; onderscheid echte werking
  van tests met gesimuleerde AI-antwoorden.
- [ ] Alleen aantoonbare fouten repareren die deze dagelijkse flows blokkeren.
- [ ] Voor livegang: actuele databasebackup, benodigde migraties en compatibiliteit
  controleren. Geen productie-reset of onbeschermde datamigratie.
- [ ] Exacte release live zetten en kernflows op productie controleren.

## Verbeteringen na de gebruiksrelease

- Strava: grote importvolumes, gelijktijdige syncs, tokenvernieuwing en aanvullende
  antwoordvalidatie. Geen verdere verfijning zolang dagelijkse flows voorrang hebben.
- Apple Health: bestaande mogelijke dubbele runs onderzoeken en na backup
  gericht herstellen; tot dan kunnen betrokken hardlooptotalen afwijken.
- Hersteladvies: kalibratie, persoonlijke baselines en voorzichtigere teksten.
  Herstelscores zijn geen medische beoordeling.
- Analyse: volledige meetelling van alle sporten en historische totalen nalopen.
- Oefeningen: afbeeldingen/licenties, cataloguskoppelingen en extra uitleg.
- Schema: melding over het einde van het blok corrigeren; live staat week 1 van
  8 maar de losse melding zegt ten onrechte dat het schema volgende week klaar is.
- Mobiel: uitgebreide fysieke iPhone-, PWA- en VoiceOver-controle.
- Beheer: monitoring, meldingen en automatische herstelpaden verder uitwerken.
- Privacy: export, bewaartermijnen en accountverwijdering vóór bredere uitrol.

## Wat al is vastgesteld

- Releasebranch `codex/catch-up-release` is gepusht; PR #58 is nog draft.
- Codecommit `961716a`: GitHub quality- en migratiechecks plus Vercel-preview groen.
- Laatste volledige lokale unit/integratiesuite: 923 tests geslaagd.
- Dit bewijst nog niet dat de nieuwste release live staat of alle gebruikersflows
  end-to-end werken. Daarop ligt nu de focus.

## Gebruikscontrole na herprioritering

- Live ingelogde Chrome-sessie: dashboard en nieuwste workout zichtbaar.
- Live schema geopend: “Blok 3 — Sterk, mobiel en fit”, week 1 van 8, vier
  trainingen. “Mijn Schema” opent de vier oefenlijsten.
- Live dashboard draait nog de oudere versie met de achterhaalde herstel- en
  slaapweergave; de release met correcties is nog niet gepromoveerd.
- Lokale browsercontrole voor schema vindt geen actief testschema. De oude
  schema-tests verwachten “Upper/Lower Split” en oude UI-selectors. Dit is geen
  bewijs dat Stefs live schema ontbreekt; dat is hierboven apart gecontroleerd.
  Testfixtures bijwerken hoort bij testonderhoud, niet bij een nieuwe productronde.
- Browserrun: 22 checks, 12 geslaagd en 10 gefaald. Zeven schemachecks vonden
  geen actief testschema, twee checks gebruikten dubbelzinnige selectors en één
  dashboardcheck toonde daadwerkelijk “Kan homepage niet laden”. Geen groene
  end-to-end releaseclaim. Chatgeschiedenis, check-in/trends, workoutdetail,
  importautorisatie en lokale lege Health-import slaagden in deze selectie.
