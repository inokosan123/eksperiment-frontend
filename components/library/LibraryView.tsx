import MainSectionCardsScreen from '@/components/shared/main-section-cards-screen';
import { LIBRARY_SECTION_CARDS } from '@/components/shared/sectionCardData';

export default function LibraryView() {
  return (
    <MainSectionCardsScreen
      title="LIBRARY"
      quote={'"Thy word is a lamp unto my feet, and a light unto my path."'}
      quoteReference="PSALM 119:105"
      cards={LIBRARY_SECTION_CARDS}
      cardsPaddingTop={14}
    />
  );
}
