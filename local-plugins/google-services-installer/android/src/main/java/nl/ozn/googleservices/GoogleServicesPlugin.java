package nl.ozn.googleservices;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.moduleinstall.ModuleInstall;
import com.google.android.gms.common.moduleinstall.ModuleInstallClient;
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest;
import com.google.android.gms.common.moduleinstall.ModuleInstallResponse;
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate;
import com.google.android.gms.common.moduleinstall.InstallStatusListener;

import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;

import java.util.ArrayList;
import java.util.List;

/**
 * Regelt Google Play Services module-installaties. Nu voor de ML Kit
 * Document Scanner; toekomstige optionele modules kunnen simpelweg aan de
 * OPTIONAL_APIS-lijst worden toegevoegd, en installAll() vraagt ze in één
 * dialoog aan.
 */
@CapacitorPlugin(name = "GoogleServices")
public class GoogleServicesPlugin extends Plugin {

    /** Retourneert of Google Play Services überhaupt beschikbaar is op dit toestel. */
    @PluginMethod
    public void status(PluginCall call) {
        int code = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(getContext());
        JSObject o = new JSObject();
        o.put("available", code == ConnectionResult.SUCCESS);
        o.put("code", code);
        o.put("description", GoogleApiAvailability.getInstance().getErrorString(code));
        call.resolve(o);
    }

    /**
     * Vraagt Google Play Services om ALLE optionele modules die de app
     * gebruikt te installeren. Als er iets nog niet lokaal staat, laat
     * Play Services een systeem-dialoog zien voor akkoord + download.
     */
    @PluginMethod
    public void installAll(PluginCall call) {
        List<com.google.android.gms.common.api.OptionalModuleApi> apis = collectOptionalApis();
        if (apis.isEmpty()) {
            JSObject o = new JSObject();
            o.put("nothingToDo", true);
            call.resolve(o);
            return;
        }

        ModuleInstallClient client = ModuleInstall.getClient(getContext());

        // Progress-updates naar de JS-kant sturen zodat de UI 'bezig' kan tonen.
        InstallStatusListener listener = update -> {
            JSObject ev = new JSObject();
            ev.put("state", update.getInstallState());
            ev.put("bytesDownloaded", update.getBytesDownloaded());
            ev.put("totalBytesToDownload", update.getTotalBytesToDownload());
            ev.put("errorCode", update.getErrorCode());
            notifyListeners("moduleProgress", ev);
        };

        ModuleInstallRequest.Builder b = ModuleInstallRequest.newBuilder();
        for (com.google.android.gms.common.api.OptionalModuleApi api : apis) {
            b.addApi(api);
        }
        b.setListener(listener);

        client.installModules(b.build())
            .addOnSuccessListener((ModuleInstallResponse resp) -> {
                JSObject o = new JSObject();
                o.put("alreadyInstalled", resp.areModulesAlreadyInstalled());
                o.put("sessionId", resp.getSessionId() == null ? 0 : resp.getSessionId());
                JSArray reqs = new JSArray();
                for (com.google.android.gms.common.api.OptionalModuleApi a : apis) {
                    reqs.put(a.getClass().getName());
                }
                o.put("requested", reqs);
                call.resolve(o);
            })
            .addOnFailureListener(e -> call.reject("Installatie starten mislukt: " + e.getMessage()));
    }

    /**
     * Bouwt de lijst met OptionalModuleApi's op basis van alle optionele
     * Google-modules die de app kent. Zet hier nieuwe features bij om ze
     * automatisch in installAll() mee te nemen.
     */
    private List<com.google.android.gms.common.api.OptionalModuleApi> collectOptionalApis() {
        List<com.google.android.gms.common.api.OptionalModuleApi> list = new ArrayList<>();

        // 1) ML Kit Document Scanner
        try {
            GmsDocumentScannerOptions opts = new GmsDocumentScannerOptions.Builder()
                .setGalleryImportAllowed(false)
                .setPageLimit(5)
                .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
                .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                .build();
            com.google.android.gms.common.api.OptionalModuleApi api =
                (com.google.android.gms.common.api.OptionalModuleApi)
                GmsDocumentScanning.getClient(opts);
            list.add(api);
        } catch (Throwable ignore) {
            // Als een module niet in deze build zit, negeren.
        }

        // 2) TODO: toekomstige optionele Play Services / ML Kit modules
        //    voeg hier hun getClient(...) aan `list` toe.

        return list;
    }
}
