plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("kotlin-parcelize")
}

android {
    namespace = "com.example.passportreader"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.passportreader"
        minSdk = 23                // EncryptedSharedPreferences vereist 23+
        targetSdk = 34
        versionCode = 2
        versionName = "0.2.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Supabase-koppeling (zelfde project als de webapp). Anon key is
        // publiek veilig — RLS regelt de toegang. Override met
        // -PsupabaseUrl=... -PsupabaseAnonKey=... als nodig.
        val sbUrl     = (project.findProperty("supabaseUrl")     as String?)
            ?: "https://mpuejmkhmlbkaelqbnae.supabase.co"
        val sbAnonKey = (project.findProperty("supabaseAnonKey") as String?)
            ?: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdWVqbWtobWxia2FlbHFibmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjI2NzQsImV4cCI6MjA5MzA5ODY3NH0.pq6GJXqEdGNzarAw0lj8DWrtAguE3T7-MI439rlmemk"
        buildConfigField("String", "SUPABASE_URL",      "\"$sbUrl\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$sbAnonKey\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    sourceSets {
        getByName("main") {
            java.srcDirs("src/main/kotlin")
        }
    }

    packaging {
        resources {
            excludes += setOf(
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/license.txt",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/notice.txt",
                "META-INF/ASL2.0",
                "META-INF/*.kotlin_module",
                "META-INF/versions/9/OSGI-INF/MANIFEST.MF"
            )
            pickFirsts += setOf(
                "org/bouncycastle/LICENSE"
            )
        }
    }
}

configurations.all {
    // BouncyCastle: jdk15to18 is bewust de gekozen variant (compatibel met
    // Android's ingebakken BC). Sluit alle jdk18on-varianten uit die
    // transitief via jMRTD/scuba binnenkomen, anders krijgen we
    // "Duplicate class org.bouncycastle.*" in checkDebugDuplicateClasses.
    exclude(group = "org.bouncycastle", module = "bcprov-jdk18on")
    exclude(group = "org.bouncycastle", module = "bcpkix-jdk18on")
    exclude(group = "org.bouncycastle", module = "bcutil-jdk18on")
}

dependencies {
    // ── Kotlin / AndroidX ───────────────────────────────────────
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")

    // ── Camera + ML Kit voor MRZ-OCR ────────────────────────────
    val cameraxVersion = "1.3.4"
    implementation("androidx.camera:camera-core:$cameraxVersion")
    implementation("androidx.camera:camera-camera2:$cameraxVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraxVersion")
    implementation("androidx.camera:camera-view:$cameraxVersion")
    implementation("com.google.mlkit:text-recognition:16.0.1")

    // ── jMRTD + SCUBA voor ICAO 9303 / BAC / PACE / DG1 / DG2 ───
    //  scuba-smartcards uitsluiten uit jMRTD's transitive deps: scuba-sc-android
    //  bevat dezelfde klassen (Android-variant) en zou anders een
    //  "Duplicate class"-fout geven in checkDebugDuplicateClasses.
    implementation("org.jmrtd:jmrtd:0.7.42") {
        exclude(group = "net.sf.scuba", module = "scuba-smartcards")
    }
    implementation("net.sf.scuba:scuba-sc-android:0.0.23")

    // ── BouncyCastle (PACE-crypto). jdk15to18 = niet-botsende variant
    //    voor Android (i.t.t. jdk15on)
    implementation("org.bouncycastle:bcprov-jdk15to18:1.78.1")
    implementation("org.bouncycastle:bcpkix-jdk15to18:1.78.1")
    // ── Geen JPEG2000-decoder: JCenter is dood, JitPack kon
    //    Gemalto/JP2ForAndroid niet bouwen (geen geldige release-tag).
    //    Pasfoto's in J2K-formaat tonen voorlopig een silhouet-
    //    placeholder; magic-byte-detectie logt het type voor diagnose.

    // ── Supabase REST-koppeling (login + dossier-update + foto-upload) ──
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    // EncryptedSharedPreferences voor het bewaren van de JWT-sessie
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    // RecyclerView voor de dossier-picker-lijst
    implementation("androidx.recyclerview:recyclerview:1.3.2")
}
