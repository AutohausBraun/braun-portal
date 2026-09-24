# Braun Portal – vorbereitete Version 2

Stand: 22.09.2026. Für das bestehende GitHub-/Vercel-/Supabase-Projekt vorbereitet.
Die Dateien sind lokal erstellt und mit Testdaten geprüft. Die produktive Datenbank und
Website wurden NICHT verändert. Vor Freigabe sind Einrichtung, Datenübernahme und echte
Anmeldetests erforderlich. Die ZIP-Datei allein ist noch keine betriebsbereite Installation.

## Funktionsumfang

- Supabase Auth statt öffentlich hinterlegtem Admin-Passwort und Klartextpasswörtern.
- Anmeldung mit vorhandenem Supabase-Auth-Passwort oder E-Mail-Anmeldelink.
- Datenbank erzwingt eigene Daten / eigene Abteilung / Adminrechte, auch bei direkten API-Aufrufen.
- Mitarbeiter anlegen, bearbeiten und deaktivieren. Kein Verlust der Abwesenheitshistorie.
- Montag bis Freitag als Standard; individuell einstellbare Arbeitstage pro Mitarbeiter.
- Urlaub beantragen, kommentieren, genehmigen, ablehnen und stornieren.
- Eigene Anträge können nicht selbst genehmigt werden; für Admin-Anträge ist ein zweiter Admin oder zuständiger Teamleiter nötig.
- Jahresanspruch, offener/reservierter Urlaub und Übertrag mit ausdrücklich hinterlegtem Ablaufdatum.
- Gesetzliche Feiertage Baden-Württemberg 2025–2030; kein Urlaub an arbeitsfreien Tagen.
- Jahresübergreifende Anträge buchen die Tage im jeweiligen Kalenderjahr.
- Arbeitstage werden beim Antrag festgeschrieben. Eine spätere Änderung am Mitarbeiter ändert alte Buchungen nicht rückwirkend.
- Feiertagsänderungen bei betroffenen Buchungen werden blockiert, bis diese geprüft/storniert und neu erfasst wurden.
- Krankmeldungen, Kalender über den gesamten Zeitraum und Abteilungsfilter.
- Serverprüfung gegen doppelte/überlappende gleichartige Abwesenheiten, ungültige Zeiträume und zu wenig Urlaub.
- Erneute Übertragung eines Antrags nach Verbindungsproblemen erzeugt durch dessen Anfragekennung keinen zweiten Eintrag.
- Protokoll der Änderungen in `bp_audit`, ohne medizinische Angaben oder Freitextinhalte.

## Inbetriebnahme – Reihenfolge

1. **Supabase-Testprojekt und Sicherung:** Vor produktiven Änderungen die bestehende Datenbank sichern. Neues Schema zuerst im Testprojekt einspielen; `config.js` dort mit Test-URL und öffentlichem Publishable-Key konfigurieren. Niemals einen Service-Role-Key in diese Datei eintragen.
2. **Datenbank:** `database.sql` ausführen, anschließend `holidays-bw.sql`. Die neuen Tabellen tragen `bp_` als Präfix. Das alte Schema wird durch diese Schritte nicht geändert.
3. **Bestandsdaten:** Wenn vorhanden, `import-legacy.sql` einmalig VOR der Einrichtung eines Adminprofils ausführen. Die Übernahme bricht bei fehlenden Daten, doppelten E-Mail-Adressen, mehrdeutigen Namen, ungültigen Zeiträumen oder überlappenden gleichartigen Buchungen vollständig ab. Alte Passwörter werden nicht übernommen. Alle importierten Personen starten als Mitarbeiter; Rollen anschließend ausdrücklich prüfen und vergeben. Bei einem Fehler Altbestand zuerst prüfen, nicht ungeprüft Daten löschen.
4. **Adminprofil:** Eine vom Betrieb benannte reale E-Mail-Adresse als Adminprofil hinterlegen. Ein vorhandenes importiertes Profil mit dieser E-Mail im Supabase Table Editor auf `role = admin` setzen; sonst dort ein neues `bp_employees`-Profil mit Vor-/Nachname, E-Mail, Abteilung und Rolle `admin` anlegen. `auth_user_id` leer lassen. Die bestätigte Anmeldung verknüpft das Profil später automatisch. Das alte `admin@braun.local` ist keine erreichbare Anmeldeadresse.
5. **E-Mail-Anmeldung:** In Supabase Auth E-Mail-Anmeldung aktivieren, E-Mail-Bestätigung eingeschaltet lassen und den geschäftlichen E-Mail-Versand einrichten. Als Site URL `https://portal.vw-braun.de` und als erlaubte Weiterleitung `https://portal.vw-braun.de/` hinterlegen. Für Vercel-Vorschauen die konkrete Vorschau-URL zusätzlich erlauben. Den normalen Magic-Link-Text von Supabase verwenden. Selbstregistrierung darf für die Anmeldelinks aktiviert sein: Ein bestätigtes Auth-Konto allein hat KEINEN Zugriff, solange kein aktives passendes Mitarbeiterprofil existiert.
6. **Neue Website vorbereiten:** Dateien dieses Ordners auf einem separaten GitHub-Branch bereitstellen und über eine Vercel-Vorschau mit dem Testprojekt prüfen. Kein Build-Schritt oder Paketmanager erforderlich; es ist weiterhin eine statische Website. SQL-Dateien dienen der Einrichtung, werden nicht automatisch ausgeführt.
7. **Anspruch und Rollen prüfen:** Im Portal Jahresanspruch pro Mitarbeiter und Jahr hinterlegen. Es wird absichtlich kein pauschaler Anspruch wie „30 Tage“ erfunden. Überträge samt Frist ausdrücklich nach den betrieblichen Vorgaben eintragen; das Formular vorbelegt den 31. März nur als editierbaren Wert. Übernommene Buchungen benötigen einen ausreichenden Anspruch, bevor weitere Anträge möglich sind.
8. **Abnahmetest:** Mit separaten Admin-, Teamleiter- und Mitarbeiterkonten Anmeldung, eigene/fremde Daten, Antrag, Freigabe, Ablehnung, Stornierung, Krankheit, Resturlaub und Mobilansicht prüfen. E-Mail-Versand, reale Bestandsdaten und Vercel-Headers sind zusätzlich in der echten Umgebung zu prüfen.
9. **Produktiver Wechsel:** Änderungen im geplanten Wartungsfenster mit dem richtigen Supabase-Projekt verbinden, Bestandsübernahme ggf. frisch durchführen und alte Website nicht mehr beschreiben lassen. Beim Wechsel `lock-legacy.sql` ausführen, damit niemand über die bisher öffentliche Schnittstelle auf Altbestände zugreifen kann. Neue Website bereitstellen und nochmals anmelden/testen. Die alte unsichere Anmeldung nicht als Rückfalllösung aktivieren.

Das öffentlich im alten Quelltext enthaltene Admin-Passwort ist kompromittiert. Falls es anderswo verwendet wurde, dort ändern. Alte Mitarbeiterpasswörter dürfen nicht weiterverwendet werden. Ein späteres Entfernen der alten Passwortspalte und die Prüfung weiterer alter Datenbankfunktionen/Views erfolgen nach Sicherung und Bestandsprüfung; `lock-legacy.sql` sperrt nur die drei bekannten Tabellen, keine unbekannten zusätzlichen Schnittstellen.

## Bewusste Grenzen

- Ganze Urlaubstage; keine halben Tage oder Stundenkonten.
- Regelmäßige Wochentage pro Mitarbeiter, keine Schichtplanung oder zeitabhängigen Arbeitsmodelle. Bei Änderung werden zukünftige bereits gebuchte Anträge bewusst geprüft und gegebenenfalls storniert/neu angelegt.
- Die Anwendung setzt die eingegebenen Ansprüche und Fristen um; keine automatische arbeitsrechtliche Bewertung oder automatische Übertragung ins Folgejahr.
- Krankmeldungen ändern Urlaub nicht automatisch. Bei Krankheit während des Urlaubs prüft der Admin den Nachweis und korrigiert die Buchung durch Stornierung und getrennte Neuerfassung; diese Historie bleibt erhalten.
- Keine Diagnosefelder, AU-Dateien, Lohnunterlagen, Push- oder Freigabe-E-Mails. Anmeldelinks sind die einzigen automatischen E-Mails.
- Teamleiter sehen Abwesenheiten ihrer Abteilung, einschließlich Krankmeldungen. Die betrieblich gewünschte Berechtigung hierfür vor Freigabe bestätigen.
- Arbeitstage und Feiertagskalender sind derzeit für einen Standort in Baden-Württemberg ausgelegt.

## Quellen

- [Gesetzliche Feiertage – Innenministerium Baden-Württemberg](https://im.baden-wuerttemberg.de/de/service/feiertage)
- [Supabase Auth: E-Mail-Anmeldung](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

Die Supabase-JavaScript-Bibliothek 2.57.4 liegt lokal unter `vendor/`; sie wird nicht von einem externen CDN zur Laufzeit geladen.
