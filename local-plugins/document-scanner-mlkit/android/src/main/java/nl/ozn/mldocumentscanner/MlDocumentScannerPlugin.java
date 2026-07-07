package nl.ozn.mldocumentscanner;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;

@CapacitorPlugin(name = "DocumentScannerMlkit")
public class MlDocumentScannerPlugin extends Plugin {

    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pendingCall;

    @Override
    public void load() {
        Activity a = getActivity();
        if (a instanceof AppCompatActivity) {
            AppCompatActivity aa = (AppCompatActivity) a;
            launcher = aa.getActivityResultRegistry().register(
                "ozn-mlkit-doc-scanner",
                aa,
                new ActivityResultContracts.StartIntentSenderForResult(),
                result -> handleResult(result.getResultCode(), result.getData())
            );
        }
    }

    @PluginMethod
    public void scan(PluginCall call) {
        if (launcher == null) {
            call.reject("Scanner niet beschikbaar in deze activity");
            return;
        }
        pendingCall = call;

        int pageLimit = call.getInt("pageLimit", 5);

        GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(false)
            .setPageLimit(pageLimit)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build();

        GmsDocumentScanning.getClient(options)
            .getStartScanIntent(getActivity())
            .addOnSuccessListener(intentSender -> {
                try {
                    launcher.launch(new IntentSenderRequest.Builder(intentSender).build());
                } catch (Exception e) {
                    pendingCall = null;
                    call.reject("Scanner starten mislukt: " + e.getMessage());
                }
            })
            .addOnFailureListener(e -> {
                pendingCall = null;
                // Meest voorkomend: Google Play Services te oud of ontbreekt.
                call.reject("Scanner niet beschikbaar: " + e.getMessage());
            });
    }

    private void handleResult(int code, Intent data) {
        PluginCall call = pendingCall;
        pendingCall = null;
        if (call == null) return;
        if (code != Activity.RESULT_OK || data == null) {
            JSObject o = new JSObject();
            o.put("cancelled", true);
            call.resolve(o);
            return;
        }
        try {
            GmsDocumentScanningResult res = GmsDocumentScanningResult.fromActivityResultIntent(data);
            if (res == null || res.getPages() == null) {
                JSObject o = new JSObject();
                o.put("cancelled", true);
                call.resolve(o);
                return;
            }
            List<GmsDocumentScanningResult.Page> pages = res.getPages();
            JSArray images = new JSArray();
            for (GmsDocumentScanningResult.Page p : pages) {
                Uri uri = p.getImageUri();
                if (uri == null) continue;
                String dataUrl = uriToDataUrl(uri);
                if (dataUrl != null) images.put(dataUrl);
            }
            JSObject out = new JSObject();
            out.put("cancelled", false);
            out.put("images", images);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Scanresultaat verwerken mislukt: " + e.getMessage());
        }
    }

    private String uriToDataUrl(Uri uri) {
        try (InputStream is = getContext().getContentResolver().openInputStream(uri)) {
            if (is == null) return null;
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) baos.write(buf, 0, n);
            String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
            return "data:image/jpeg;base64," + b64;
        } catch (Exception e) {
            return null;
        }
    }
}
