// Rouwkaart-generator — printbare A6/A5-kaart met dossier-data + optionele foto

function renderRouwkaart(params) {
  const id = parseInt(params.id, 10);
  const d = DB.byId(KEYS.DOSSIERS, id);
  if (!d) return render404();

  const naam = fullName(d) || '—';
  const dpa = d.doopnaam ? '<div class="rk-doopnaam">' + esc(d.doopnaam) + '</div>' : '';
  const geb = [fmtDate(d.geboortedatum), d.geboorteplaats].filter(Boolean).join(' te ');
  const ovl = [fmtDate(d.overlijdensdatum), d.overlijdensplaats].filter(Boolean).join(' te ');
  const uitv = [fmtDate(d.uitvaart_datum), d.uitvaart_tijd && 'om ' + d.uitvaart_tijd].filter(Boolean).join(' ');
  const s = Settings.all();

  $('#view').innerHTML = `
    <div class="page rouwkaart-page">
      <div class="page-head no-print">
        <div>
          <a href="#/dossiers/${d.id}" class="back-link">← Terug naar dossier</a>
          <h1>Rouwkaart</h1>
          <p class="muted">Dossier <strong>${esc(d.dossier_nummer)}</strong></p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-primary" id="btn-rk-print">📄 Printen / opslaan als PDF</button>
        </div>
      </div>

      <div class="rouwkaart-doc">
        <div class="rouwkaart-card">
          <div class="rk-cross">✝</div>
          <p class="rk-intro">In dankbare herinnering aan</p>
          <h2 class="rk-naam">${esc(naam)}</h2>
          ${dpa}
          <div class="rk-data">
            ${geb ? `<div><span class="rk-symbol">*</span> ${esc(geb)}</div>` : ''}
            ${ovl ? `<div><span class="rk-symbol">†</span> ${esc(ovl)}</div>` : ''}
          </div>
          ${(d.uitvaart_datum || d.kerk_locatie || d.begraafplaats) ? `
            <div class="rk-uitvaart">
              ${d.uitvaart_datum ? `<p><strong>Uitvaartdienst</strong><br>${esc(uitv)}</p>` : ''}
              ${d.kerk_locatie ? `<p>${esc(d.kerk_locatie)}</p>` : ''}
              ${d.begraafplaats ? `<p>Aansluitend ter aardebestelling op<br>${esc(d.begraafplaats)}</p>` : ''}
            </div>` : ''}
          ${d.contact_naam ? `<p class="rk-familie">Familie ${esc(d.contact_naam)}</p>` : ''}
          <div class="rk-footer">${esc(s.app_name || 'Uitvaartbeheer')} · ${esc(s.app_tagline || '')}</div>
        </div>
      </div>
    </div>`;

  $('#btn-rk-print').addEventListener('click', () => window.print());
}
