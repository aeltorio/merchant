import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, VariantPrice } from '../lib/api';
import { Plus, X, Loader2 } from 'lucide-react';

type Props = {
  productId: string;
  variantId: string;
};

export function VariantPrices({ productId, variantId }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState('');
  const [priceInput, setPriceInput] = useState('');

  // Fetch variant prices
  const { data, isLoading } = useQuery({
    queryKey: ['variant-prices', productId, variantId],
    queryFn: () => api.listVariantPrices(productId, variantId),
  });

  // Fetch available currencies
  const { data: currenciesData, isLoading: currenciesLoading } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.getCurrencies(),
  });

  const prices = data?.items || [];
  const currencies = currenciesData?.items || [];

  // Upsert price mutation
  const upsertMutation = useMutation({
    mutationFn: (data: { currency_id: string; price_cents: number }) =>
      api.upsertVariantPrice(productId, variantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variant-prices'] });
      resetForm();
    },
  });

  // Delete price mutation
  const deleteMutation = useMutation({
    mutationFn: (currencyId: string) =>
      api.deleteVariantPrice(productId, variantId, currencyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variant-prices'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCurrencyId || !priceInput) return;

    const priceCents = Math.round(parseFloat(priceInput) * 100);
    upsertMutation.mutate({
      currency_id: selectedCurrencyId,
      price_cents: priceCents,
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedCurrencyId('');
    setPriceInput('');
  };

  const handleEdit = (price: VariantPrice) => {
    setSelectedCurrencyId(price.currency_id);
    setPriceInput((price.price_cents / 100).toFixed(2));
    setShowForm(true);
  };

  const handleDelete = (currencyId: string) => {
    if (confirm('Delete this price?')) {
      deleteMutation.mutate(currencyId);
    }
  };

  if (isLoading) {
    return (
      <div className="h-20 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          Prices by Currency
        </label>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded font-semibold transition-colors"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <Plus size={12} />
          Add Price
        </button>
      </div>

      {/* Price list */}
      {prices.length === 0 ? (
        <div className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
          No prices configured. Set prices for this variant in different currencies.
        </div>
      ) : (
        <div className="space-y-1.5">
          {prices.map((price) => (
            <div
              key={price.id}
              className="flex items-center justify-between p-2 rounded-lg"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold">{price.currency_code}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {price.symbol}
                  {(price.price_cents / 100).toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleEdit(price)}
                  disabled={upsertMutation.isPending}
                  className="px-2 py-1 text-xs rounded transition-colors disabled:opacity-50"
                  style={{ color: 'var(--accent)', background: 'transparent' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(price.currency_id)}
                  disabled={deleteMutation.isPending}
                  className="p-1 rounded transition-colors disabled:opacity-50"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-3 rounded-lg space-y-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Currency
            </label>
            <select
              value={selectedCurrencyId}
              onChange={(e) => setSelectedCurrencyId(e.target.value)}
              required
              disabled={currenciesLoading}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <option value="">Select currency...</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} - {currency.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Price
            </label>
            <input
              type="number"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="0.00"
              required
              step="0.01"
              min="0"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg focus:outline-none focus:ring-2"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upsertMutation.isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {upsertMutation.isPending ? 'Saving...' : 'Save Price'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
