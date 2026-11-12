plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.familyguard.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.familyguard.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0-demo"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// No third-party libraries: only the Android SDK and the Kotlin standard library.
dependencies {
}
