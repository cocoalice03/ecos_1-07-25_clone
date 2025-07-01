import DeepDiagnostic from "@/components/debug/DeepDiagnostic";
import AuthDebugger from "@/components/debug/AuthDebugger";
import CustomElementDiagnostic from "@/components/debug/CustomElementDiagnostic";

export default function DiagnosticPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">System Diagnostics</h1>
          <p className="text-gray-600">Deep analysis of application health and performance</p>
        </div>
      </div>
      <div className="py-6">
        <DeepDiagnostic />
        <AuthDebugger email="cherubindavid@gmail.com" />
        <CustomElementDiagnostic />
      </div>
    </div>
  );
}