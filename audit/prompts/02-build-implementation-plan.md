Lees AUDIT.md (door mij aangevuld met eigen prioriteiten). Je taak: een gefaseerd
IMPLEMENTATION_PLAN.md schrijven. Wijzig nu nog geen broncode.

Groepeer in fases op afhankelijkheid en risico:
- Fase 0: quick wins en kritieke security/compliance-fixes (Critical/High).
- Fase 1..n: grotere features en refactors, in logische volgorde.

Per taak:
- Titel + waarom (link naar finding-ID uit AUDIT.md).
- Exacte bestandspaden die je raakt.
- De wijziging in 2-4 zinnen.
- Verificatie: welke test/commando/handmatige check bewijst dat het werkt.
- Rollback: hoe terug te draaien.
- Effort S/M/L en afhankelijkheden.

Houd elke taak klein genoeg om in een afgebakende diff te reviewen. Markeer taken
die een beslissing van mij nodig hebben voordat ze uitvoerbaar zijn.
