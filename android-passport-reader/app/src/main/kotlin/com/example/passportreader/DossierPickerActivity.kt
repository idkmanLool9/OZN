package com.example.passportreader

import android.app.AlertDialog
import android.os.Build
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.passportreader.cloud.SupabaseClient
import com.example.passportreader.databinding.ActivityDossierPickerBinding
import com.example.passportreader.databinding.ItemDossierBinding
import com.example.passportreader.model.PassportData
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class DossierPickerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDossierPickerBinding
    private lateinit var passport: PassportData
    private lateinit var cloud: SupabaseClient
    private val adapter = DossierAdapter { onDossierTapped(it) }
    private var searchJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDossierPickerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val parsed: PassportData? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(PassportData.EXTRA_KEY, PassportData::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(PassportData.EXTRA_KEY)
        }
        if (parsed == null) { finish(); return }
        passport = parsed

        cloud = SupabaseClient.get(this)
        if (!cloud.isLoggedIn) { finish(); return }

        binding.list.layoutManager = LinearLayoutManager(this)
        binding.list.adapter = adapter

        binding.subtitle.text = getString(
            R.string.picker_subtitle,
            listOfNotNull(passport.givenNames, passport.surname).joinToString(" "),
        )

        binding.search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun afterTextChanged(s: Editable?) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchJob?.cancel()
                searchJob = lifecycleScope.launch {
                    delay(280)
                    loadDossiers(s?.toString())
                }
            }
        })

        loadDossiers(null)
    }

    private fun loadDossiers(query: String?) {
        binding.progress.visibility = View.VISIBLE
        binding.empty.visibility = View.GONE
        lifecycleScope.launch {
            try {
                val list = cloud.listDossiers(query)
                adapter.submit(list)
                binding.empty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            } catch (e: Exception) {
                Toast.makeText(this@DossierPickerActivity,
                    "Dossiers ophalen mislukt: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                binding.progress.visibility = View.GONE
            }
        }
    }

    private fun onDossierTapped(d: SupabaseClient.DossierSummary) {
        val patchPreview = passportToPatch(passport)
        val previewText = buildString {
            patchPreview.forEach { (k, v) -> if (v != null) appendLine("• $k: $v") }
        }
        val displayName = d.displayName + (d.dossierNummer?.let { " (#$it)" } ?: "")
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.picker_confirm_title))
            .setMessage(getString(R.string.picker_confirm_message, displayName) + "\n\n" + previewText)
            .setNegativeButton(R.string.picker_confirm_cancel, null)
            .setPositiveButton(R.string.picker_confirm_apply) { _, _ -> applyToDossier(d) }
            .show()
    }

    private fun applyToDossier(d: SupabaseClient.DossierSummary) {
        binding.progress.visibility = View.VISIBLE
        lifecycleScope.launch {
            // Twee aparte foutmeldingen zodat je in de toast kan zien
            // welke stap precies struikelt: foto-upload of dossier-update.
            try {
                val patch = passportToPatch(passport).toMutableMap()
                val faceBytes = passport.faceImageJpeg
                if (faceBytes != null && faceBytes.isNotEmpty()) {
                    val path = try {
                        cloud.uploadOverledeneFoto(d.id, faceBytes)
                    } catch (e: Exception) {
                        throw SupabaseClient.SupabaseException("Pasfoto opslaan mislukt: ${e.message}")
                    }
                    patch["foto_overledene_pad"] = path
                }
                try {
                    cloud.updateDossier(d.id, patch)
                } catch (e: Exception) {
                    throw SupabaseClient.SupabaseException("Dossier bijwerken mislukt: ${e.message}")
                }
                Toast.makeText(this@DossierPickerActivity,
                    getString(R.string.picker_success, d.displayName),
                    Toast.LENGTH_LONG).show()
                setResult(RESULT_OK)
                finish()
            } catch (e: Exception) {
                Toast.makeText(this@DossierPickerActivity,
                    e.message ?: "Onbekende fout", Toast.LENGTH_LONG).show()
            } finally {
                binding.progress.visibility = View.GONE
            }
        }
    }

    // ─── Mapping van DG1-velden naar dossier-kolommen ──────────────────────
    private fun passportToPatch(p: PassportData): Map<String, String?> {
        val voornaam = p.givenNames?.split(" ")?.firstOrNull()?.takeIf { it.isNotBlank() }
        val achternaam = p.surname?.trim()?.takeIf { it.isNotBlank() }
        val geboortedatum = isoFromYYMMDD(p.dateOfBirth)
        val geslacht = when (p.gender?.uppercase()) {
            "MALE", "M" -> "M"
            "FEMALE", "F" -> "V"
            else -> null
        }
        val nat = p.nationality?.trim()?.takeIf { it.isNotBlank() }
        val bsn = p.bsn?.takeIf { PassportData.isValidBsn(it) }
        return mapOf(
            "voornaam" to voornaam,
            "achternaam" to achternaam,
            "geboortedatum" to geboortedatum,
            "geslacht" to geslacht,
            "nationaliteit" to nat,
            "bsn" to bsn,
        )
    }

    /** YYMMDD → YYYY-MM-DD volgens ICAO-eeuw-conventie. */
    private fun isoFromYYMMDD(raw: String?): String? {
        if (raw == null || raw.length != 6 || !raw.all { it.isDigit() }) return null
        val yy = raw.substring(0, 2).toInt()
        val mm = raw.substring(2, 4)
        val dd = raw.substring(4, 6)
        val thisYY = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR) % 100
        val century = if (yy > thisYY + 10) "19" else "20"
        return "$century${"%02d".format(yy)}-$mm-$dd"
    }

    // ─── RecyclerView adapter ─────────────────────────────────────────────
    private class DossierAdapter(
        val onClick: (SupabaseClient.DossierSummary) -> Unit,
    ) : RecyclerView.Adapter<DossierAdapter.VH>() {
        private val items = mutableListOf<SupabaseClient.DossierSummary>()

        fun submit(newItems: List<SupabaseClient.DossierSummary>) {
            items.clear(); items.addAll(newItems); notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val b = ItemDossierBinding.inflate(LayoutInflater.from(parent.context), parent, false)
            return VH(b)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val d = items[position]
            holder.bind(d, onClick)
        }

        override fun getItemCount(): Int = items.size

        class VH(val b: ItemDossierBinding) : RecyclerView.ViewHolder(b.root) {
            fun bind(d: SupabaseClient.DossierSummary, onClick: (SupabaseClient.DossierSummary) -> Unit) {
                b.name.text = d.displayName
                b.avatar.text = initials(d.displayName)
                val parts = mutableListOf<String>()
                d.dossierNummer?.let { parts += "#$it" }
                d.gezinsnummer?.let { parts += "gezin $it" }
                d.status?.let { parts += it.replace('_', ' ') }
                b.meta.text = parts.joinToString(" · ").ifBlank { "—" }
                b.root.setOnClickListener { onClick(d) }
            }

            private fun initials(name: String): String {
                val words = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
                if (words.isEmpty()) return "?"
                val first = words.first().firstOrNull()?.uppercase() ?: ""
                val last  = if (words.size > 1) words.last().firstOrNull()?.uppercase() ?: "" else ""
                return (first + last).ifBlank { "?" }
            }
        }
    }
}
