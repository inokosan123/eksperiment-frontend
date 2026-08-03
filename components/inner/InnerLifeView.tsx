import MainSectionCardsScreen from '@/components/shared/main-section-cards-screen';
import { INNER_SECTION_CARDS } from '@/components/shared/sectionCardData';

export default function InnerLifeView() {
  return (
    <MainSectionCardsScreen
      title="INNER LIFE"
      quote={'"The Kingdom of God is within you."'}
      quoteReference="LUKE 17:21"
      cards={INNER_SECTION_CARDS}
      cardsPaddingTop={4}
    />
  );
}
