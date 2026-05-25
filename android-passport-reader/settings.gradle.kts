pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // JitPack — voor jp2-android (gemalto's GitHub-source, sinds
        // JCenter dood is de enige bereikbare distributie van JP2Decoder)
        maven { setUrl("https://jitpack.io") }
    }
}

rootProject.name = "PassportReader"
include(":app")
