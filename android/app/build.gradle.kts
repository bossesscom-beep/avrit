plugins {
    id("com.android.application")
}

val webAssetsDir = layout.projectDirectory.dir("src/main/assets")

tasks.register<Exec>("copyWebApp") {
    inputs.files(
        rootProject.file("../index.html"),
        rootProject.file("../css"),
        rootProject.file("../js"),
        rootProject.file("../scripts/copy-web.sh"),
    )
    outputs.dir(webAssetsDir)
    commandLine(
        "bash",
        rootProject.file("../scripts/copy-web.sh").absolutePath,
        webAssetsDir.asFile.absolutePath,
    )
}

android {
    namespace = "in.bighelpers.avrit"
    compileSdk = 36

    defaultConfig {
        applicationId = "in.bighelpers.avrit"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
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
}

tasks.named("preBuild").configure {
    dependsOn("copyWebApp")
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.13.0")
}
