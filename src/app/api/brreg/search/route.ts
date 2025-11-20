import { NextRequest, NextResponse } from 'next/server';

type BrregAddress = {
  adresse?: string[];
  postnummer?: string;
  poststed?: string;
};

type BrregEntity = {
  organisasjonsnummer?: string;
  navn?: string;
  forretningsadresse?: BrregAddress;
};

type BrregResponse = {
  _embedded?: {
    enheter?: BrregEntity[];
  };
};

const BASE_URL =
  'https://data.brreg.no/enhetsregisteret/api/enheter?size=5&konkurs=false';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json([]);
  }

  const url = `${BASE_URL}&navn=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Brreg API failed', await response.text());
      return NextResponse.json(
        { error: 'Kunne ikke hente data fra Brønnøysundregisteret' },
        { status: 502 },
      );
    }

    const data = (await response.json()) as BrregResponse;
    const suggestions =
      data._embedded?.enheter?.map((entity) => {
        const address = entity.forretningsadresse ?? {};
        const street = (address.adresse ?? []).join(', ');

        return {
          orgNumber: entity.organisasjonsnummer ?? '',
          companyName: entity.navn ?? '',
          address: street,
          postalCode: address.postnummer ?? '',
          city: address.poststed ?? '',
        };
      }) ?? [];

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Brreg fetch error', error);
    return NextResponse.json(
      { error: 'Uventet feil ved oppslag mot Brønnøysundregisteret' },
      { status: 500 },
    );
  }
}

