import { View } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components';
import { useFoodSearch } from '@/hooks/useFoodSearch';
import { errorMessage } from '@/lib/errors';
import { MIN_QUERY_LENGTH, normalizeQuery } from '@/lib/foodSearch';
import { useTheme } from '@/theme';
import type { Food } from '@/types/food';

import { FoodCard } from './FoodCard';

type SearchResultsProps = {
  /** The text to search for (debounce it before passing it in). */
  query: string;
  onSelect: (food: Food) => void;
};

/** Search results with every state: too short, loading, error, no matches, and matches. */
export function SearchResults({ query, onSelect }: SearchResultsProps) {
  const { spacing } = useTheme();
  const search = useFoodSearch(query);
  const normalized = normalizeQuery(query);

  if (normalized.length < MIN_QUERY_LENGTH) {
    return (
      <EmptyState
        title="Search for a food"
        message={`Enter at least ${MIN_QUERY_LENGTH} letters, like “banana” or “oats”.`}
      />
    );
  }
  if (search.isLoading) {
    return <LoadingState label="Searching…" />;
  }
  if (search.isError) {
    return (
      <ErrorState
        title="Search failed"
        message={errorMessage(search.error, 'Check your connection and try again.')}
        onRetry={() => void search.refetch()}
      />
    );
  }

  const foods = search.data ?? [];
  if (foods.length === 0) {
    return (
      <EmptyState
        title="No foods found"
        message={`Nothing matches “${query.trim()}”. Check the spelling or try a simpler word.`}
      />
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {foods.map((food) => (
        <FoodCard key={food.id} food={food} onPress={onSelect} />
      ))}
    </View>
  );
}
