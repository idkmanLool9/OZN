package com.example.passportreader

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.passportreader.cloud.SupabaseClient
import com.example.passportreader.databinding.ActivityLoginBinding
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val cloud = SupabaseClient.get(this)
        if (cloud.isLoggedIn) {
            // Al ingelogd — direct terug.
            finish(); return
        }

        binding.btnLogin.setOnClickListener { doLogin() }
        binding.inputPassword.setOnEditorActionListener { _, _, _ -> doLogin(); true }
    }

    private fun doLogin() {
        val email = binding.inputEmail.text?.toString()?.trim().orEmpty()
        val pw = binding.inputPassword.text?.toString().orEmpty()
        if (email.isEmpty() || pw.isEmpty()) {
            showError("Vul e-mailadres en wachtwoord in.")
            return
        }
        binding.error.visibility = View.GONE
        binding.btnLogin.isEnabled = false
        binding.progress.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                SupabaseClient.get(this@LoginActivity).signIn(email, pw)
                setResult(RESULT_OK)
                finish()
            } catch (e: Exception) {
                showError(e.message ?: "Login mislukt")
            } finally {
                binding.btnLogin.isEnabled = true
                binding.progress.visibility = View.GONE
            }
        }
    }

    private fun showError(msg: String) {
        binding.error.text = msg
        binding.error.visibility = View.VISIBLE
    }
}
