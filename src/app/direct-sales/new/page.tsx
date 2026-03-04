import SaleForm from '../components/SaleForm';

export default function NewSalePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold mb-6">New Direct Sale</h1>
        <SaleForm mode="new" />
      </div>
    </div>
  );
}